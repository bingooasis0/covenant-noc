/**
 * Notification Sound Service
 * Generates custom notification sounds using Web Audio API
 * No external audio files required - all sounds are synthesized
 */

class NotificationSounds {
  constructor() {
    this.audioContext = null;
    this._enabled = null;
    this._volume = null;

    // Initialize on first use to avoid autoplay restrictions
    this.initAudioContext = this.initAudioContext.bind(this);
  }

  get enabled() {
    if (this._enabled === null && typeof window !== 'undefined' && window.localStorage) {
      const savedEnabled = localStorage.getItem('noc-sounds-enabled');
      this._enabled = savedEnabled === null ? true : savedEnabled === 'true';
    }
    return this._enabled !== null ? this._enabled : true;
  }

  set enabled(value) {
    this._enabled = value;
  }

  get volume() {
    if (this._volume === null && typeof window !== 'undefined' && window.localStorage) {
      const savedVolume = localStorage.getItem('noc-sound-volume');
      this._volume = savedVolume ? parseFloat(savedVolume) : 0.3;
    }
    return this._volume !== null ? this._volume : 0.3;
  }

  set volume(value) {
    this._volume = value;
  }

  initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported', e);
        this.enabled = false;
      }
    }
    return this.audioContext;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // Create an oscillator with envelope
  createTone(frequency, duration, type = 'sine') {
    const ctx = this.initAudioContext();
    if (!ctx || !this.enabled) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }

  // Play multiple tones in sequence
  playSequence(notes) {
    const ctx = this.initAudioContext();
    if (!ctx || !this.enabled) return;

    let currentTime = ctx.currentTime;

    notes.forEach(note => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = note.type || 'sine';
      oscillator.frequency.value = note.frequency;

      const duration = note.duration || 0.1;
      const volume = (note.volume || 1) * this.volume;

      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      currentTime += note.duration || 0.1;
    });
  }

  // Success sound - pleasant ascending chime
  playSuccess() {
    this.playSequence([
      { frequency: 523.25, duration: 0.08, type: 'sine' }, // C5
      { frequency: 659.25, duration: 0.08, type: 'sine' }, // E5
      { frequency: 783.99, duration: 0.15, type: 'sine' }, // G5
    ]);
  }

  // Error sound - attention-grabbing descending tone
  playError() {
    this.playSequence([
      { frequency: 400, duration: 0.1, type: 'square', volume: 0.6 },
      { frequency: 350, duration: 0.1, type: 'square', volume: 0.6 },
      { frequency: 300, duration: 0.2, type: 'square', volume: 0.6 },
    ]);
  }

  // Warning sound - two-tone alert
  playWarning() {
    this.playSequence([
      { frequency: 800, duration: 0.1, type: 'sine', volume: 0.7 },
      { frequency: 600, duration: 0.1, type: 'sine', volume: 0.7 },
      { frequency: 800, duration: 0.15, type: 'sine', volume: 0.7 },
    ]);
  }

  // Info sound - single soft chime
  playInfo() {
    this.createTone(800, 0.15, 'sine');
  }

  // Site Online - triumphant ascending sequence
  playSiteOnline() {
    this.playSequence([
      { frequency: 523.25, duration: 0.08, type: 'sine' }, // C5
      { frequency: 659.25, duration: 0.08, type: 'sine' }, // E5
      { frequency: 783.99, duration: 0.08, type: 'sine' }, // G5
      { frequency: 1046.50, duration: 0.2, type: 'sine' }, // C6
    ]);
  }

  // Site Offline - urgent descending alarm
  playSiteOffline() {
    this.playSequence([
      { frequency: 800, duration: 0.12, type: 'square', volume: 0.8 },
      { frequency: 600, duration: 0.12, type: 'square', volume: 0.8 },
      { frequency: 400, duration: 0.12, type: 'square', volume: 0.8 },
      { frequency: 300, duration: 0.25, type: 'square', volume: 0.8 },
    ]);
  }

  // Alert sound - attention-demanding siren-like
  playAlert() {
    const ctx = this.initAudioContext();
    if (!ctx || !this.enabled) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';

    // Sweep from 600Hz to 800Hz and back
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
    oscillator.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2);
    oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
    oscillator.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.7, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  }

  // Critical Alert - more urgent, longer siren
  playCriticalAlert() {
    const ctx = this.initAudioContext();
    if (!ctx || !this.enabled) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'square';

    // More dramatic sweep
    oscillator.frequency.setValueAtTime(500, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12);
    oscillator.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.24);
    oscillator.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.36);
    oscillator.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.48);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.8, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }

  // High Latency - pulsing warning
  playHighLatency() {
    this.playSequence([
      { frequency: 700, duration: 0.08, type: 'sine', volume: 0.6 },
      { frequency: 0, duration: 0.05 }, // silence
      { frequency: 700, duration: 0.08, type: 'sine', volume: 0.6 },
      { frequency: 0, duration: 0.05 }, // silence
      { frequency: 700, duration: 0.12, type: 'sine', volume: 0.6 },
    ]);
  }

  // Packet Loss - choppy interrupted sound
  playPacketLoss() {
    this.playSequence([
      { frequency: 600, duration: 0.06, type: 'square', volume: 0.5 },
      { frequency: 0, duration: 0.04 },
      { frequency: 650, duration: 0.06, type: 'square', volume: 0.5 },
      { frequency: 0, duration: 0.04 },
      { frequency: 700, duration: 0.06, type: 'square', volume: 0.5 },
      { frequency: 0, duration: 0.04 },
      { frequency: 750, duration: 0.1, type: 'square', volume: 0.5 },
    ]);
  }

  // High CPU/Memory - rapid beeping
  playHighResource() {
    this.playSequence([
      { frequency: 900, duration: 0.05, type: 'sine', volume: 0.6 },
      { frequency: 0, duration: 0.03 },
      { frequency: 900, duration: 0.05, type: 'sine', volume: 0.6 },
      { frequency: 0, duration: 0.03 },
      { frequency: 900, duration: 0.05, type: 'sine', volume: 0.6 },
      { frequency: 0, duration: 0.03 },
      { frequency: 1000, duration: 0.1, type: 'sine', volume: 0.6 },
    ]);
  }

  // Data Operation Complete - confirmation beep
  playDataOperation() {
    this.playSequence([
      { frequency: 600, duration: 0.08, type: 'sine' },
      { frequency: 800, duration: 0.12, type: 'sine' },
    ]);
  }

  // Bulk Operation - multiple confirmations
  playBulkOperation() {
    this.playSequence([
      { frequency: 500, duration: 0.06, type: 'sine' },
      { frequency: 600, duration: 0.06, type: 'sine' },
      { frequency: 700, duration: 0.06, type: 'sine' },
      { frequency: 800, duration: 0.15, type: 'sine' },
    ]);
  }
}

// Create singleton instance
const notificationSounds = new NotificationSounds();

// Initialize audio context on user interaction (required by browsers)
let initialized = false;
const initializeOnInteraction = () => {
  if (!initialized) {
    notificationSounds.initAudioContext();
    initialized = true;
  }
};

// Add listeners for user interaction
if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown'].forEach(event => {
    window.addEventListener(event, initializeOnInteraction, { once: true });
  });
}

export default notificationSounds;

// Convenience exports
export const playSoundForNotificationType = (type, severity = 'normal') => {
  switch (type) {
    case 'site-online':
      notificationSounds.playSiteOnline();
      break;
    case 'site-offline':
      notificationSounds.playSiteOffline();
      break;
    case 'alert-critical':
    case 'site-down':
      notificationSounds.playCriticalAlert();
      break;
    case 'alert-high':
    case 'high-latency':
      notificationSounds.playHighLatency();
      break;
    case 'alert-medium':
    case 'packet-loss':
      notificationSounds.playPacketLoss();
      break;
    case 'high-cpu':
    case 'high-memory':
      notificationSounds.playHighResource();
      break;
    case 'alert':
    case 'warning':
      notificationSounds.playAlert();
      break;
    case 'error':
      notificationSounds.playError();
      break;
    case 'success':
      notificationSounds.playSuccess();
      break;
    case 'info':
      notificationSounds.playInfo();
      break;
    case 'data-operation':
      notificationSounds.playDataOperation();
      break;
    case 'bulk-operation':
      notificationSounds.playBulkOperation();
      break;
    default:
      notificationSounds.playInfo();
  }
};

export const setSoundVolume = (volume) => {
  notificationSounds.setVolume(volume);
};

export const setSoundEnabled = (enabled) => {
  notificationSounds.setEnabled(enabled);
};
