/**
 * In-Run Superpower System for Flappy Bird
 * Manages power cooldowns, duration counters, visual fx states, and hotkeys.
 */

import { sound } from './audio.js';

export const POWERS_CONFIG = {
  shield: {
    id: 'shield',
    name: 'Shield',
    icon: '🛡️',
    cost: 5,
    duration: 4.0,
    hotkey: '1',
    description: 'Pass invulnerably through pipes'
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    icon: '🧲',
    cost: 4,
    duration: 6.0,
    hotkey: '2',
    description: 'Attract nearby gold coins'
  },
  multiplier: {
    id: 'multiplier',
    name: '2X Score',
    icon: '⚡',
    cost: 8,
    duration: 8.0,
    hotkey: '3',
    description: 'Earn double points per pipe'
  }
};

export class PowerManager {
  constructor() {
    this.activeTimers = {
      shield: 0,
      magnet: 0,
      multiplier: 0
    };

    // Callback on state change (power activated/expired)
    this.onChange = null;

    // DOM References
    this.hudBar = document.getElementById('powers-hud');
    this.btnShield = document.getElementById('power-btn-shield');
    this.btnMagnet = document.getElementById('power-btn-magnet');
    this.btnMultiplier = document.getElementById('power-btn-multiplier');

    this.initEvents();
  }

  setChangeCallback(cb) {
    this.onChange = cb;
  }

  initEvents() {
    // Button clicks / touches
    const wireBtn = (btn, powerId) => {
      if (!btn) return;
      const trigger = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.triggerActivation(powerId);
      };
      btn.addEventListener('pointerdown', trigger);
    };

    wireBtn(this.btnShield, 'shield');
    wireBtn(this.btnMagnet, 'magnet');
    wireBtn(this.btnMultiplier, 'multiplier');

    // Hotkey triggers (1, 2, 3)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === '1') this.triggerActivation('shield');
      if (e.key === '2') this.triggerActivation('magnet');
      if (e.key === '3') this.triggerActivation('multiplier');
    });
  }

  setCoinManager(coinManager) {
    this.coinManager = coinManager;
  }

  triggerActivation(powerId) {
    if (!this.coinManager) return false;
    const config = POWERS_CONFIG[powerId];
    if (!config) return false;

    // Check available purse
    if (this.coinManager.totalCoins < config.cost) {
      // Flash button red for insufficient funds
      this.flashInsufficientFunds(powerId);
      return false;
    }

    // Deduct cost and save
    this.coinManager.totalCoins -= config.cost;
    localStorage.setItem('flappy_total_coins', this.coinManager.totalCoins.toString());

    // Stack or reset duration
    this.activeTimers[powerId] = config.duration;

    // Play fanfare
    sound.playPowerup();

    if (this.onChange) {
      this.onChange(this.getActiveSummary());
    }

    this.updateHUDDisplay();
    return true;
  }

  flashInsufficientFunds(powerId) {
    const btnMap = {
      shield: this.btnShield,
      magnet: this.btnMagnet,
      multiplier: this.btnMultiplier
    };
    const btn = btnMap[powerId];
    if (btn) {
      btn.classList.add('power-cant-afford');
      setTimeout(() => btn.classList.remove('power-cant-afford'), 350);
    }
  }

  update(dt) {
    let changed = false;

    for (const [key, timeLeft] of Object.entries(this.activeTimers)) {
      if (timeLeft > 0) {
        const nextTime = Math.max(0, timeLeft - dt);
        this.activeTimers[key] = nextTime;
        if (nextTime === 0) {
          sound.playPowerExpired();
          changed = true;
        }
      }
    }

    this.updateHUDDisplay();

    if (changed && this.onChange) {
      this.onChange(this.getActiveSummary());
    }
  }

  isShieldActive() {
    return this.activeTimers.shield > 0;
  }

  isMagnetActive() {
    return this.activeTimers.magnet > 0;
  }

  isMultiplierActive() {
    return this.activeTimers.multiplier > 0;
  }

  getActiveSummary() {
    return {
      shield: this.isShieldActive(),
      magnet: this.isMagnetActive(),
      multiplier: this.isMultiplierActive()
    };
  }

  reset() {
    this.activeTimers.shield = 0;
    this.activeTimers.magnet = 0;
    this.activeTimers.multiplier = 0;
    this.updateHUDDisplay();
  }

  updateHUDDisplay() {
    const totalCoins = this.coinManager ? this.coinManager.totalCoins : 0;

    const updateBtn = (btn, powerId) => {
      if (!btn) return;
      const config = POWERS_CONFIG[powerId];
      const timeLeft = this.activeTimers[powerId];
      const isActive = timeLeft > 0;
      const canAfford = totalCoins >= config.cost;

      btn.classList.toggle('power-active', isActive);
      btn.classList.toggle('power-disabled', !canAfford && !isActive);

      // Timer badge
      const timerBadge = btn.querySelector('.power-timer-badge');
      if (timerBadge) {
        if (isActive) {
          timerBadge.style.display = 'block';
          timerBadge.textContent = `${timeLeft.toFixed(1)}s`;
        } else {
          timerBadge.style.display = 'none';
        }
      }

      // Cost badge
      const costBadge = btn.querySelector('.power-cost-val');
      if (costBadge) {
        costBadge.textContent = config.cost;
      }
    };

    updateBtn(this.btnShield, 'shield');
    updateBtn(this.btnMagnet, 'magnet');
    updateBtn(this.btnMultiplier, 'multiplier');
  }
}
