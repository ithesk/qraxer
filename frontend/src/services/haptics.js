/**
 * Haptic feedback service
 * - Android: Uses Vibration API
 * - iOS: Uses AudioContext for subtle click sounds (iOS doesn't support Vibration API)
 */

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Check vibration support
const hasVibration = 'vibrate' in navigator && !isIOS;

// Audio context for iOS click sounds
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

// Play a subtle click sound for iOS
const playClick = (frequency = 1800, duration = 0.01, volume = 0.1) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (required for iOS)
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

// Vibration patterns for Android (duration in ms)
const patterns = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 20],
  warning: [30, 50, 30],
  error: [50, 30, 50, 30, 50],
  selection: [5],
  impact: [15],
};

// Click sounds for iOS (frequency, duration, volume)
const sounds = {
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
 * Trigger haptic feedback
 * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'|'selection'|'impact'} type
 */
export const haptic = (type = 'light') => {
  try {
    if (hasVibration) {
      // Android: use vibration
      const pattern = patterns[type] || patterns.light;
      navigator.vibrate(pattern);
    } else if (isIOS) {
      // iOS: use audio click
      const [freq, dur, vol] = sounds[type] || sounds.light;
      playClick(freq, dur, vol);
    }
  } catch (e) {
    // Silently fail - haptics are enhancement, not critical
  }
};

// Convenience methods
export const haptics = {
  light: () => haptic('light'),
  medium: () => haptic('medium'),
  heavy: () => haptic('heavy'),
  success: () => haptic('success'),
  warning: () => haptic('warning'),
  error: () => haptic('error'),
  selection: () => haptic('selection'),
  impact: () => haptic('impact'),

  // Alias for common use cases
  tap: () => haptic('light'),
  press: () => haptic('impact'),
  confirm: () => haptic('success'),
  cancel: () => haptic('warning'),

  // Initialize audio context on first user interaction (required for iOS)
  init: () => {
    if (isIOS) {
      getAudioContext();
    }
  },
};

export default haptics;
