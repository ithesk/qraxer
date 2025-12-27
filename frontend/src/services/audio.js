/**
 * Audio feedback service using Web Audio API
 * Generates sounds programmatically without external files
 */

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a beep sound
 * @param {number} frequency - Frequency in Hz (default 1000)
 * @param {number} duration - Duration in ms (default 150)
 * @param {number} volume - Volume 0-1 (default 0.3)
 * @param {string} type - Oscillator type: sine, square, triangle, sawtooth (default sine)
 */
function beep(frequency = 1000, duration = 150, volume = 0.3, type = 'sine') {
  try {
    const ctx = getAudioContext();

    // Resume context if suspended (required for iOS)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    // Fade in/out to avoid clicks
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);

    oscillator.start(now);
    oscillator.stop(now + duration / 1000);
  } catch (e) {
    console.log('[Audio] Error playing beep:', e.message);
  }
}

/**
 * Play success sound (two ascending tones)
 */
function success() {
  beep(880, 100, 0.2, 'sine');  // A5
  setTimeout(() => beep(1320, 150, 0.2, 'sine'), 100);  // E6
}

/**
 * Play error sound (descending tone)
 */
function error() {
  beep(400, 200, 0.25, 'square');
  setTimeout(() => beep(300, 250, 0.2, 'square'), 150);
}

/**
 * Play scan beep (short confirmation sound)
 */
function scan() {
  beep(1200, 80, 0.25, 'sine');
}

/**
 * Initialize audio context on user interaction
 * Call this on first user tap/click to enable audio on iOS
 */
function init() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Play silent sound to unlock audio
    beep(1, 1, 0);
  } catch (e) {
    // Ignore
  }
}

export const audio = {
  beep,
  success,
  error,
  scan,
  init,
};

export default audio;
