/**
 * Diagnostic & Calibration Module
 * Handles engine diagnostics, assists, and performance calibration.
 * Adaptive touch targets and gesture recognition across mobile and desktop.
 */

import { sound } from './audio.js';

export const Flags = {
  ghostMode: false,
  superSpeed: false,
  flatMap: false
};

export class DiagnosticManager {
  constructor({ onOpen, onClose }) {
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.isOpen = false;

    // Keystroke sequence buffer
    this.keyBuffer = [];
    this.maxKeyWindowMs = 3000;
    // Char codes for: c (99), h (104), e (101), a (97), t (116)
    this.triggerSequence = [99, 104, 101, 97, 116];

    // Corner tap detection buffer
    this.cornerTaps = [];
    this.maxTapWindowMs = 1200;

    this.initListeners();
  }

  initListeners() {
    // 1. Keyboard sequence detection within 3.0s window
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        return;
      }

      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'checkbox') {
        return;
      }

      if (e.key.length === 1) {
        const code = e.key.toLowerCase().charCodeAt(0);
        const now = Date.now();
        this.keyBuffer.push({ code, time: now });

        this.keyBuffer = this.keyBuffer.filter(k => now - k.time <= this.maxKeyWindowMs);

        if (this.keyBuffer.length >= this.triggerSequence.length) {
          const slice = this.keyBuffer.slice(-this.triggerSequence.length).map(k => k.code);
          const isMatch = this.triggerSequence.every((expected, idx) => expected === slice[idx]);
          if (isMatch) {
            this.keyBuffer = [];
            this.trigger();
          }
        }
      }
    });

    // 2. Corner tap / click detection: adaptive responsive top-right corner zone
    const handlePointer = (e) => {
      const container = document.getElementById('game-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : null);

      if (x === null || y === null) return;

      // Adaptive corner dimension (minimum 80px, up to 24% of container width)
      const cornerSize = Math.max(80, rect.width * 0.24);
      const isTopRight = (x >= rect.right - cornerSize && x <= rect.right + 25) &&
                         (y >= rect.top - 25 && y <= rect.top + cornerSize);

      if (isTopRight) {
        const now = Date.now();
        this.cornerTaps.push(now);

        this.cornerTaps = this.cornerTaps.filter(time => now - time <= this.maxTapWindowMs);

        if (this.cornerTaps.length >= 3) {
          this.cornerTaps = [];
          this.trigger();
        }
      }
    };

    window.addEventListener('pointerdown', handlePointer, { passive: true });
  }

  trigger() {
    if (this.isOpen) return;

    sound.playChime();
    this.open();
  }

  ensureModal() {
    if (this.modal) return;

    let modal = document.getElementById('diag-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'diag-modal';
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = `
        <div class="diag-modal-content">
          <div class="diag-modal-header">
            <span class="diag-glitch">⚡ OVERRIDE CONSOLE ⚡</span>
            <button id="diag-close-btn" class="close-x">&times;</button>
          </div>
          <p class="diag-subtitle">CALIBRATION &amp; ASSIST PROTOCOLS</p>

          <div class="diag-options-list">
            <label class="diag-toggle-row">
              <div class="diag-info">
                <span class="diag-name">Ghost Mode</span>
                <span class="diag-desc">Ignore all collisions &amp; glow cyan</span>
              </div>
              <input type="checkbox" id="diag-ghost">
              <span class="slider"></span>
            </label>

            <label class="diag-toggle-row">
              <div class="diag-info">
                <span class="diag-name">Super Speed</span>
                <span class="diag-desc">2.5&times; Game velocity &amp; scaled spawns</span>
              </div>
              <input type="checkbox" id="diag-speed">
              <span class="slider"></span>
            </label>

            <label class="diag-toggle-row">
              <div class="diag-info">
                <span class="diag-name">Flat Map</span>
                <span class="diag-desc">Lock pipe gaps strictly to center line</span>
              </div>
              <input type="checkbox" id="diag-flat">
              <span class="slider"></span>
            </label>
          </div>

          <div class="diag-footer">
            <button id="diag-resume-btn" class="arcade-btn diag-btn">RESUME GAME</button>
          </div>
        </div>
      `;

      const container = document.getElementById('game-container') || document.body;
      container.appendChild(modal);

      modal.querySelector('#diag-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
      modal.querySelector('#diag-resume-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });

      this.toggleGhost = modal.querySelector('#diag-ghost');
      this.toggleSpeed = modal.querySelector('#diag-speed');
      this.toggleFlat = modal.querySelector('#diag-flat');

      this.toggleGhost.addEventListener('change', (e) => {
        Flags.ghostMode = e.target.checked;
        this.updateBadges();
      });

      this.toggleSpeed.addEventListener('change', (e) => {
        Flags.superSpeed = e.target.checked;
        this.updateBadges();
      });

      this.toggleFlat.addEventListener('change', (e) => {
        Flags.flatMap = e.target.checked;
        this.updateBadges();
      });
    }

    this.modal = modal;
  }

  open() {
    this.ensureModal();
    this.isOpen = true;

    if (this.toggleGhost) this.toggleGhost.checked = Flags.ghostMode;
    if (this.toggleSpeed) this.toggleSpeed.checked = Flags.superSpeed;
    if (this.toggleFlat) this.toggleFlat.checked = Flags.flatMap;

    this.modal.classList.remove('hidden');

    if (this.onOpen) {
      this.onOpen();
    }
  }

  close() {
    this.isOpen = false;

    if (this.modal) {
      this.modal.classList.add('hidden');
    }

    this.updateBadges();

    if (this.onClose) {
      this.onClose();
    }
  }

  updateBadges() {
    let badgeContainer = document.getElementById('diag-badges');
    if (!badgeContainer) {
      const container = document.getElementById('game-container');
      if (container) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'diag-badges';
        badgeContainer.className = 'diag-badges';
        container.appendChild(badgeContainer);
      }
    }
    if (!badgeContainer) return;

    badgeContainer.innerHTML = '';

    if (Flags.ghostMode) {
      const badge = document.createElement('div');
      badge.className = 'badge badge-ghost';
      badge.textContent = '👻 GHOST';
      badgeContainer.appendChild(badge);
    }

    if (Flags.superSpeed) {
      const badge = document.createElement('div');
      badge.className = 'badge badge-speed';
      badge.textContent = '⚡ 2.5x SPEED';
      badgeContainer.appendChild(badge);
    }

    if (Flags.flatMap) {
      const badge = document.createElement('div');
      badge.className = 'badge badge-flat';
      badge.textContent = '📏 FLAT MAP';
      badgeContainer.appendChild(badge);
    }
  }
}
