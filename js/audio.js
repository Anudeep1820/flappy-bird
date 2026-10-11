/**
 * Procedural Web Audio API sound generator for Flappy Bird
 * Zero external asset dependencies.
 * Cross-platform auto-resume for iOS Safari and mobile browsers.
 */

class AudioController {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.unlocked = false;

    this.setupUnlockListeners();
  }

  setupUnlockListeners() {
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') {
        this.unlocked = true;
        ['touchstart', 'touchend', 'pointerdown', 'keydown'].forEach(evt => {
          window.removeEventListener(evt, unlock);
        });
      }
    };

    ['touchstart', 'touchend', 'pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { passive: true });
    });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playFlap() {
    this.init();
    if (!this.ctx || this.muted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.1);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Audio playback failsafe
    }
  }

  playScore() {
    this.init();
    if (!this.ctx || this.muted) return;

    try {
      const now = this.ctx.currentTime;
      
      [587.33, 880.00].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + (i * 0.08);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.22, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
      });
    } catch {
      // Audio playback failsafe
    }
  }

  playHit() {
    this.init();
    if (!this.ctx || this.muted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio playback failsafe
    }
  }

  /**
   * Ascending retro 4-note arpeggio chime
   * Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
   */
  playChime() {
    this.init();
    if (!this.ctx || this.muted) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const noteDuration = 0.09;
      const now = this.ctx.currentTime;

      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + (index * noteDuration);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.1);
      });
    } catch {
      // Audio playback failsafe
    }
  }
}

export const sound = new AudioController();
