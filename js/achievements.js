/**
 * Achievements System for Flappy Bird Arcade
 * Manages unlocked milestones, persistent badges, celebration toasts, and Trophy Room modal.
 */

import { sound } from './audio.js';

export const ACHIEVEMENTS = [
  {
    id: 'first_flight',
    icon: '🐣',
    title: 'First Flight',
    desc: 'Flap your wings and start your aviation adventure.',
    category: 'progression'
  },
  {
    id: 'score_10',
    icon: '🥉',
    title: 'Bronze Aviator',
    desc: 'Score 10 points in a single run.',
    category: 'skill'
  },
  {
    id: 'score_25',
    icon: '🥈',
    title: 'Silver Ace',
    desc: 'Score 25 points in a single run.',
    category: 'skill'
  },
  {
    id: 'score_50',
    icon: '🥇',
    title: 'Golden Legend',
    desc: 'Score 50 points in a single run.',
    category: 'skill'
  },
  {
    id: 'score_100',
    icon: '👑',
    title: 'Century Club',
    desc: 'Score 100 points! You are among the elite flyers.',
    category: 'mastery'
  },
  {
    id: 'sunset_flyer',
    icon: '🌅',
    title: 'Twilight Flyer',
    desc: 'Fly far enough to witness the golden sunset sky.',
    category: 'exploration'
  },
  {
    id: 'night_flyer',
    icon: '🌌',
    title: 'Midnight Stargazer',
    desc: 'Soar through the starry midnight cosmos.',
    category: 'exploration'
  },
  {
    id: 'coin_hoarder',
    icon: '🪙',
    title: 'Pocket Change',
    desc: 'Collect 10 coins in a single flight.',
    category: 'coins'
  },
  {
    id: 'wealthy_bird',
    icon: '💰',
    title: 'Coin Tycoon',
    desc: 'Bank a lifetime total of 50 gold coins.',
    category: 'coins'
  },
  {
    id: 'power_shield',
    icon: '🛡️',
    title: 'Aegis Forcefield',
    desc: 'Defend your bird with an active Shield superpower.',
    category: 'powers'
  },
  {
    id: 'power_magnet',
    icon: '🧲',
    title: 'Magnetic Attraction',
    desc: 'Attract gold coins from afar using the Magnet power.',
    category: 'powers'
  },
  {
    id: 'power_trio',
    icon: '⚡',
    title: 'Full Arsenal',
    desc: 'Activate all 3 distinct superpowers in a single run.',
    category: 'powers'
  },
  {
    id: 'multiplayer_match',
    icon: '🌐',
    title: 'Arena Gladiator',
    desc: 'Compete in a real-time multiplayer room match.',
    category: 'multiplayer'
  },
  {
    id: 'multiplayer_win',
    icon: '🏆',
    title: 'Podium Champion',
    desc: 'Finish 1st place in a multiplayer match against rivals.',
    category: 'multiplayer'
  }
];

export class AchievementManager {
  constructor() {
    this.unlocked = new Set();
    this.toastQueue = [];
    this.isToastShowing = false;
    this.toastEl = null;

    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('flappy_achievements') || '[]');
      if (Array.isArray(saved)) {
        this.unlocked = new Set(saved);
      }
    } catch {
      this.unlocked = new Set();
    }
  }

  save() {
    try {
      localStorage.setItem('flappy_achievements', JSON.stringify(Array.from(this.unlocked)));
    } catch {}
  }

  setToastElement(el) {
    this.toastEl = el;
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  unlock(id) {
    if (this.unlocked.has(id)) return false;

    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return false;

    this.unlocked.add(id);
    this.save();

    sound.playAchievement();
    this.queueToast(ach);
    return true;
  }

  queueToast(ach) {
    this.toastQueue.push(ach);
    if (!this.isToastShowing) {
      this.showNextToast();
    }
  }

  showNextToast() {
    if (this.toastQueue.length === 0) {
      this.isToastShowing = false;
      return;
    }

    this.isToastShowing = true;
    const ach = this.toastQueue.shift();

    if (!this.toastEl) {
      this.isToastShowing = false;
      return;
    }

    this.toastEl.innerHTML = `
      <div class="toast-icon">${ach.icon}</div>
      <div class="toast-body">
        <div class="toast-title">UNLOCKED: ${ach.title}</div>
        <div class="toast-desc">${ach.desc}</div>
      </div>
    `;

    this.toastEl.classList.remove('hidden', 'hide');
    this.toastEl.classList.add('show');

    setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastEl.classList.add('hide');

      setTimeout(() => {
        this.toastEl.classList.add('hidden');
        this.showNextToast();
      }, 350);
    }, 3200);
  }

  getProgress() {
    return {
      unlocked: this.unlocked.size,
      total: ACHIEVEMENTS.length,
      pct: Math.round((this.unlocked.size / ACHIEVEMENTS.length) * 100)
    };
  }

  renderList(containerEl) {
    if (!containerEl) return;

    const progress = this.getProgress();
    const html = `
      <div class="ach-summary-bar">
        <div class="ach-summary-text">
          <span>TROPHIES: <strong>${progress.unlocked}/${progress.total}</strong> (${progress.pct}%)</span>
        </div>
        <div class="ach-progress-outer">
          <div class="ach-progress-inner" style="width: ${progress.pct}%;"></div>
        </div>
      </div>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map(ach => {
          const isDone = this.unlocked.has(ach.id);
          return `
            <div class="ach-card ${isDone ? 'unlocked' : 'locked'}">
              <div class="ach-card-icon">${isDone ? ach.icon : '🔒'}</div>
              <div class="ach-card-info">
                <div class="ach-card-title">${ach.title}</div>
                <div class="ach-card-desc">${ach.desc}</div>
              </div>
              <div class="ach-card-status">${isDone ? 'COMPLETED' : 'LOCKED'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    containerEl.innerHTML = html;
  }
}

export const achievements = new AchievementManager();
