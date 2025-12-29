/**
 * Haptic feedback service
 * - Native iOS/Android: Uses Capacitor Haptics (best experience)
 * - Web fallback: Uses Vibration API or AudioContext
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

// Detect iOS for web fallback
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Check vibration support for web
const hasVibration = 'vibrate' in navigator && !isIOS;

// Audio context for iOS web fallback
let audioContext = null;

const getAudioContext = () => {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    try {
      audioContext = new AudioContext();
    } catch (e) {
      // Audio not supported
    }
  }
  return audioContext;
};

// Play a subtle click sound for iOS web
const playClick = (frequency = 1800, duration = 0.01, volume = 0.1) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail
  }
};

// Web fallback patterns
const webPatterns = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 20],
  warning: [30, 50, 30],
  error: [50, 30, 50, 30, 50],
  selection: [5],
  impact: [15],
};

// iOS web fallback sounds
const webSounds = {
  light: [2000, 0.008, 0.05],
  medium: [1800, 0.01, 0.08],
  heavy: [1500, 0.015, 0.1],
  success: [2200, 0.02, 0.1],
  warning: [800, 0.03, 0.1],
  error: [400, 0.05, 0.15],
  selection: [2400, 0.005, 0.03],
  impact: [1600, 0.012, 0.08],
};

/**
 * Native haptic feedback using Capacitor
 */
const nativeHaptics = {
  // Light tap - for UI selections
  light: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
  },

  // Medium tap - for confirmations
  medium: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
  },

  // Heavy tap - for important actions
  heavy: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {}
  },

  // Success - QR detected OK, operation completed
  success: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {}
  },

  // Warning - not found, needs attention
  warning: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {}
  },

  // Error - operation failed
  error: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {}
  },

  // Selection change - tab switches, list items
  selection: async () => {
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (e) {}
  },

  // Impact - button press
  impact: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
  },

  // Scan detected - quick double tap
  scanDetected: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }, 50);
    } catch (e) {}
  },

  // Not found - distinctive warning pattern
  notFound: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 150);
    } catch (e) {}
  },
};

/**
 * Web fallback haptic feedback
 */
const webHaptic = (type = 'light') => {
  try {
    if (hasVibration) {
      const pattern = webPatterns[type] || webPatterns.light;
      navigator.vibrate(pattern);
    } else if (isIOS) {
      const [freq, dur, vol] = webSounds[type] || webSounds.light;
      playClick(freq, dur, vol);
    }
  } catch (e) {}
};

const webHaptics = {
  light: () => webHaptic('light'),
  medium: () => webHaptic('medium'),
  heavy: () => webHaptic('heavy'),
  success: () => webHaptic('success'),
  warning: () => webHaptic('warning'),
  error: () => webHaptic('error'),
  selection: () => webHaptic('selection'),
  impact: () => webHaptic('impact'),
  scanDetected: () => {
    webHaptic('light');
    setTimeout(() => webHaptic('medium'), 50);
  },
  notFound: () => {
    webHaptic('warning');
    setTimeout(() => webHaptic('heavy'), 150);
  },
};

/**
 * Exported haptics service
 * Automatically uses native or web based on platform
 */
export const haptics = {
  // Basic haptics
  light: () => isNative ? nativeHaptics.light() : webHaptics.light(),
  medium: () => isNative ? nativeHaptics.medium() : webHaptics.medium(),
  heavy: () => isNative ? nativeHaptics.heavy() : webHaptics.heavy(),

  // Notification haptics
  success: () => isNative ? nativeHaptics.success() : webHaptics.success(),
  warning: () => isNative ? nativeHaptics.warning() : webHaptics.warning(),
  error: () => isNative ? nativeHaptics.error() : webHaptics.error(),

  // UI haptics
  selection: () => isNative ? nativeHaptics.selection() : webHaptics.selection(),
  impact: () => isNative ? nativeHaptics.impact() : webHaptics.impact(),

  // Scan-specific haptics
  scanDetected: () => isNative ? nativeHaptics.scanDetected() : webHaptics.scanDetected(),
  notFound: () => isNative ? nativeHaptics.notFound() : webHaptics.notFound(),

  // Aliases for common use cases
  tap: () => isNative ? nativeHaptics.light() : webHaptics.light(),
  press: () => isNative ? nativeHaptics.impact() : webHaptics.impact(),
  confirm: () => isNative ? nativeHaptics.success() : webHaptics.success(),
  cancel: () => isNative ? nativeHaptics.warning() : webHaptics.warning(),

  // Initialize (for web fallback)
  init: () => {
    if (!isNative && isIOS) {
      getAudioContext();
    }
  },
};

export default haptics;
