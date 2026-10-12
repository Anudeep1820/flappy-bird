/**
 * Main game coordinator for Flappy Bird
 * Integrates rendering loop, physics, sound, HUD, diagnostic controls,
 * and global scoreboard telemetry.
 */

import { Bird } from './bird.js';
import { PipeManager } from './pipes.js';
import { sound } from './audio.js';
import { Flags, DiagnosticManager } from './diagnostics.js';
import { leaderboardClient } from './leaderboard.js';
import { SkinsManager } from './skins.js';

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.width = 360;
    this.height = 600;
    this.groundHeight = 96;

    this.setupDPI();

    // DOM UI Elements
    this.startOverlay = document.getElementById('start-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.topBarOverlay = document.getElementById('top-bar-overlay');
    this.hudScore = document.getElementById('hud-score');
    this.finalScoreEl = document.getElementById('final-score');
    this.highScoreEl = document.getElementById('high-score');
    this.medalIcon = document.getElementById('medal-icon');
    this.restartBtn = document.getElementById('restart-btn');

    // Leaderboard & Submit UI
    this.leaderboardBtnTop = document.getElementById('leaderboard-btn-top');
    this.leaderboardBtnOver = document.getElementById('leaderboard-btn-over');
    this.openSubmitModalBtn = document.getElementById('open-submit-modal-btn');
    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
    this.leaderboardList = document.getElementById('leaderboard-list');

    this.submitModal = document.getElementById('submit-modal');
    this.submitCloseBtn = document.getElementById('submit-close-btn');
    this.playerNameInput = document.getElementById('player-name-input');
    this.submitScoreBtn = document.getElementById('submit-score-btn');
    this.submitStatusMsg = document.getElementById('submit-status-msg');

    // Skins UI
    this.skinsBtnTop = document.getElementById('skins-btn-top');
    this.skinsBtnOver = document.getElementById('skins-btn-over');

    // States: 'IDLE', 'PLAYING', 'PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS', 'GAMEOVER'
    this.state = 'IDLE';
    this.previousState = 'IDLE';
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('flappy_highscore') || '0', 10);
    this.gameOverTime = 0;
    this.lastSubmittedScoreId = null;
    this.leaderboardPollTimer = null;

    // Entities
    this.bird = new Bird(this.width, this.height);
    this.pipes = new PipeManager(this.width, this.height, this.groundHeight);

    // Skins Manager
    this.skinsManager = new SkinsManager({
      onSkinChange: (skin) => this.bird.setSkin(skin),
      onOpen: () => this.handleSkinsOpen(),
      onClose: () => this.handleSkinsClose()
    });
    this.bird.setSkin(this.skinsManager.getActiveSkin());

    // Visuals & Parallax
    this.groundOffset = 0;
    this.cloudOffset = 0;
    this.cityOffset = 0;
    this.shakeFrames = 0;
    this.particles = [];

    // Diagnostic / Assist Manager
    this.diagManager = new DiagnosticManager({
      onOpen: () => this.handleDiagOpen(),
      onClose: () => this.handleDiagClose()
    });

    this.initEvents();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  initEvents() {
    // 1. Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.key === 'Enter' && e.target === this.playerNameInput) {
          e.preventDefault();
          this.handleScoreSubmit();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this.state === 'PAUSED_LEADERBOARD') this.closeLeaderboard();
        if (this.state === 'PAUSED_SUBMIT') this.closeSubmitModal();
        if (this.state === 'PAUSED_SKINS') this.skinsManager.close();
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.handleActionInput();
      } else if (e.code === 'Enter' && this.state === 'GAMEOVER') {
        e.preventDefault();
        this.restartGame();
      }
    });

    // 2. Touch / Pointer Controls across all screen zones
    const onActionPointer = (e) => {
      // Ignore clicks inside open modal overlays or buttons
      if (['PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS'].includes(this.state)) return;
      if (e.target.closest('#diag-modal') || e.target.closest('#leaderboard-modal') || e.target.closest('#submit-modal') || e.target.closest('#skins-modal')) return;
      if (e.target.closest('#top-bar-overlay')) return;
      if (e.target.closest('.gameover-actions button')) return;

      if (this.state === 'GAMEOVER') {
        const timeSinceGameOver = performance.now() - this.gameOverTime;
        if (timeSinceGameOver > 400) {
          this.restartGame();
        }
        return;
      }

      // In IDLE or PLAYING: Tap anywhere registers as flap!
      this.handleActionInput();
    };

    if (this.container) {
      this.container.addEventListener('pointerdown', onActionPointer);
      this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // 3. Restart button
    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restartGame();
      });
    }

    // 4. Top Rankings Button
    if (this.leaderboardBtnTop) {
      this.leaderboardBtnTop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openLeaderboard();
      });
    }
    if (this.leaderboardBtnOver) {
      this.leaderboardBtnOver.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openLeaderboard();
      });
    }
    if (this.leaderboardCloseBtn) {
      this.leaderboardCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeLeaderboard();
      });
    }

    // 5. Submit Score Modal Triggers
    if (this.openSubmitModalBtn) {
      this.openSubmitModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSubmitModal();
      });
    }
    if (this.submitCloseBtn) {
      this.submitCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSubmitModal();
      });
    }
    if (this.submitScoreBtn) {
      this.submitScoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleScoreSubmit();
      });
    }

    // 6. Skins Locker Modal Triggers
    if (this.skinsBtnTop) {
      this.skinsBtnTop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.skinsManager.open();
      });
    }
    if (this.skinsBtnOver) {
      this.skinsBtnOver.addEventListener('click', (e) => {
        e.stopPropagation();
        this.skinsManager.open();
      });
    }

    // 7. Responsive Resize & Orientation Change
    const handleResize = () => {
      this.setupDPI();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100);
    });
  }

  handleActionInput() {
    if (this.state === 'IDLE') {
      this.startGame();
      this.bird.flap();
      sound.playFlap();
      this.spawnFeathers(this.bird.x, this.bird.y);
    } else if (this.state === 'PLAYING') {
      this.bird.flap();
      sound.playFlap();
      this.spawnFeathers(this.bird.x, this.bird.y);
    }
  }

  startGame() {
    this.state = 'PLAYING';
    if (this.startOverlay) this.startOverlay.classList.add('hidden');
    if (this.topBarOverlay) this.topBarOverlay.style.display = 'none'; // Clean gameplay!
    if (this.hudScore) this.hudScore.textContent = '0';
    this.score = 0;
  }

  handleDiagOpen() {
    this.previousState = this.state;
    this.state = 'PAUSED_DIAG';
  }

  handleDiagClose() {
    this.state = this.previousState;
    this.lastTime = performance.now();
  }

  handleSkinsOpen() {
    this.previousState = this.state;
    this.state = 'PAUSED_SKINS';
  }

  handleSkinsClose() {
    this.state = this.previousState;
    this.lastTime = performance.now();
  }

  openSubmitModal() {
    this.previousState = this.state;
    this.state = 'PAUSED_SUBMIT';

    if (this.playerNameInput) {
      this.playerNameInput.value = localStorage.getItem('flappy_player_name') || '';
    }
    if (this.submitStatusMsg) {
      this.submitStatusMsg.textContent = '';
    }

    if (this.submitModal) {
      this.submitModal.classList.remove('hidden');
    }
  }

  closeSubmitModal() {
    this.state = this.previousState;
    if (this.submitModal) {
      this.submitModal.classList.add('hidden');
    }
  }

  async openLeaderboard() {
    this.previousState = this.state;
    this.state = 'PAUSED_LEADERBOARD';

    if (this.leaderboardModal) {
      this.leaderboardModal.classList.remove('hidden');
    }

    if (this.leaderboardList) {
      this.leaderboardList.innerHTML = `<div style="text-align: center; color: #88aacc; padding: 24px; font-size: 11px;">Loading live rankings...</div>`;
      await this.refreshLeaderboardData();
    }

    // Auto-poll leaderboard every 5 seconds while modal is open
    clearInterval(this.leaderboardPollTimer);
    this.leaderboardPollTimer = setInterval(() => {
      this.refreshLeaderboardData();
    }, 5000);
  }

  closeLeaderboard() {
    clearInterval(this.leaderboardPollTimer);
    this.state = this.previousState;
    this.lastTime = performance.now();

    if (this.leaderboardModal) {
      this.leaderboardModal.classList.add('hidden');
    }
  }

  async refreshLeaderboardData() {
    const scores = await leaderboardClient.fetchScores();
    this.renderLeaderboardRows(scores);
  }

  renderLeaderboardRows(scores) {
    if (!this.leaderboardList) return;

    if (!scores || scores.length === 0) {
      this.leaderboardList.innerHTML = `<div style="text-align: center; color: #88aacc; padding: 24px; font-size: 11px;">No rankings yet. Be the first to score!</div>`;
      return;
    }

    this.leaderboardList.innerHTML = scores.slice(0, 30).map((s, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
      const isMe = this.lastSubmittedScoreId && this.lastSubmittedScoreId === s.id;

      return `
        <div class="leaderboard-row ${isMe ? 'highlight-me' : ''}">
          <div class="leaderboard-left">
            <span class="rank-pill ${rankClass}">#${rank}</span>
            <span class="player-name-label">${this.escapeHtml(s.name || 'Anonymous')}</span>
          </div>
          <span class="leaderboard-score-val">${s.score}</span>
        </div>
      `;
    }).join('');
  }

  async handleScoreSubmit() {
    if (!this.playerNameInput) return;
    const name = this.playerNameInput.value.trim() || 'Player';
    const medal = this.getMedalName(this.score);

    if (this.submitStatusMsg) {
      this.submitStatusMsg.textContent = 'Saving to live database...';
      this.submitStatusMsg.style.color = '#38bdf8';
    }

    const entry = await leaderboardClient.submitScore(name, this.score, medal);
    if (entry) {
      this.lastSubmittedScoreId = entry.id;
      if (this.submitStatusMsg) {
        this.submitStatusMsg.textContent = 'Saved!';
        this.submitStatusMsg.style.color = '#4ade80';
      }
      setTimeout(() => {
        this.closeSubmitModal();
        this.openLeaderboard();
      }, 300);
    } else {
      if (this.submitStatusMsg) {
        this.submitStatusMsg.textContent = 'Failed to submit. Try again.';
        this.submitStatusMsg.style.color = '#f87171';
      }
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.gameOverTime = performance.now();
    this.bird.isDead = true;
    sound.playHit();
    this.shakeFrames = 14;

    if (this.topBarOverlay) this.topBarOverlay.style.display = 'flex';

    // Log gameplay telemetry immediately
    leaderboardClient.logGamePlayed(this.score);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('flappy_highscore', this.highScore.toString());
    }

    if (this.finalScoreEl) this.finalScoreEl.textContent = this.score;
    if (this.highScoreEl) this.highScoreEl.textContent = this.highScore;

    this.assignMedal(this.score);

    if (this.gameoverOverlay) {
      setTimeout(() => {
        this.gameoverOverlay.classList.remove('hidden');
      }, 350);
    }
  }

  getMedalName(score) {
    if (score >= 70) return 'platinum';
    if (score >= 40) return 'gold';
    if (score >= 20) return 'silver';
    if (score >= 10) return 'bronze';
    return 'none';
  }

  assignMedal(score) {
    if (!this.medalIcon) return;
    this.medalIcon.className = 'medal-icon';

    const medal = this.getMedalName(score);
    this.medalIcon.classList.add(`medal-${medal}`);
  }

  restartGame() {
    this.score = 0;
    if (this.hudScore) this.hudScore.textContent = '0';
    this.bird.reset();
    this.pipes.reset();
    this.particles = [];

    if (this.gameoverOverlay) this.gameoverOverlay.classList.add('hidden');
    if (this.startOverlay) this.startOverlay.classList.remove('hidden');
    if (this.topBarOverlay) this.topBarOverlay.style.display = 'flex';

    this.state = 'IDLE';
  }

  spawnFeathers(x, y) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: x - 10,
        y: y + 8,
        vx: (Math.random() - 0.5) * 2 - 1,
        vy: Math.random() * 2 + 0.5,
        size: Math.random() * 2.5 + 1.5,
        alpha: 0.9,
        color: '#ffffff'
      });
    }
  }

  spawnScoreBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 / 10) * i;
      const speed = Math.random() * 2.5 + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        alpha: 1,
        color: '#ffe600'
      });
    }
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (['PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS'].includes(this.state)) return;

    const speedMult = Flags.superSpeed ? 2.5 : 1.0;
    const scrollDelta = 2.4 * speedMult;

    // Background & ground parallax scrolling
    if (this.state !== 'GAMEOVER') {
      this.cloudOffset = (this.cloudOffset + 0.4 * speedMult) % 360;
      this.cityOffset = (this.cityOffset + 0.9 * speedMult) % 360;
      this.groundOffset = (this.groundOffset + scrollDelta) % 24;
    }

    // Bird idle hover bobbing
    if (this.state === 'IDLE') {
      this.bird.y = (this.height / 2 - 40) + Math.sin(performance.now() * 0.005) * 6;
      this.bird.animTick++;
      if (this.bird.animTick % 6 === 0) {
        this.bird.wingPhase = (this.bird.wingPhase + 1) % 4;
      }
    }

    // Active gameplay update
    if (this.state === 'PLAYING') {
      this.bird.update(dt, Flags);

      this.pipes.update(dt, Flags, this.bird, () => {
        this.score++;
        if (this.hudScore) this.hudScore.textContent = this.score;
        sound.playScore();
        this.spawnScoreBurst(this.bird.x + 20, this.bird.y);
      });

      // Collision Check
      if (this.pipes.checkCollision(this.bird, Flags)) {
        this.gameOver();
      }
    }

    // Bird falling after gameover hit
    if (this.state === 'GAMEOVER') {
      const playableHeight = this.height - this.groundHeight;
      if (this.bird.y < playableHeight - this.bird.height / 2) {
        this.bird.velocity += this.bird.gravity * 1.5;
        this.bird.y += this.bird.velocity;
        this.bird.rotation = Math.min(Math.PI / 2, this.bird.rotation + 0.08);
      }
    }

    // Particle system update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.035;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Screen shake decay
    if (this.shakeFrames > 0) {
      this.shakeFrames--;
    }
  }

  render() {
    this.ctx.save();

    if (this.shakeFrames > 0) {
      const shakeMag = this.shakeFrames * 0.7;
      const offsetX = (Math.random() - 0.5) * shakeMag;
      const offsetY = (Math.random() - 0.5) * shakeMag;
      this.ctx.translate(offsetX, offsetY);
    }

    // 1. Sky Gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height - this.groundHeight);
    skyGrad.addColorStop(0, '#4ec0ca');
    skyGrad.addColorStop(1, '#a1e4e6');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. Parallax Clouds Layer
    this.drawClouds();

    // 3. Parallax City Skyline Layer
    this.drawSkyline();

    // 4. Pipes
    this.pipes.draw(this.ctx);

    // 5. Ground Layer
    this.drawGround();

    // 6. Particles
    this.drawParticles();

    // 7. Bird Entity
    this.bird.draw(this.ctx, Flags);

    this.ctx.restore();
  }

  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const baseY = 240;

    for (let i = -1; i < 3; i++) {
      const x = i * 200 - (this.cloudOffset * 0.6);
      this.ctx.beginPath();
      this.ctx.arc(x + 40, baseY, 28, 0, Math.PI * 2);
      this.ctx.arc(x + 75, baseY - 12, 34, 0, Math.PI * 2);
      this.ctx.arc(x + 110, baseY, 26, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawSkyline() {
    const baseY = this.height - this.groundHeight;
    this.ctx.fillStyle = '#83cfb8';

    for (let i = -1; i < 3; i++) {
      const startX = i * 240 - this.cityOffset;
      this.ctx.fillRect(startX + 10, baseY - 60, 42, 60);
      this.ctx.fillRect(startX + 58, baseY - 85, 34, 85);
      this.ctx.fillRect(startX + 98, baseY - 45, 52, 45);
      this.ctx.fillRect(startX + 156, baseY - 70, 36, 70);
      this.ctx.fillRect(startX + 198, baseY - 50, 32, 50);

      this.ctx.fillStyle = '#b7edd8';
      this.ctx.fillRect(startX + 65, baseY - 75, 6, 8);
      this.ctx.fillRect(startX + 77, baseY - 75, 6, 8);
      this.ctx.fillRect(startX + 65, baseY - 60, 6, 8);
      this.ctx.fillRect(startX + 77, baseY - 60, 6, 8);
      this.ctx.fillStyle = '#83cfb8';
    }
  }

  drawGround() {
    const groundY = this.height - this.groundHeight;
    const groundW = this.width;

    this.ctx.fillStyle = '#73bf2e';
    this.ctx.fillRect(0, groundY, groundW, 14);

    this.ctx.fillStyle = '#8be238';
    this.ctx.fillRect(0, groundY, groundW, 3);

    this.ctx.fillStyle = '#543847';
    this.ctx.fillRect(0, groundY + 14, groundW, 2);

    this.ctx.fillStyle = '#ded895';
    this.ctx.fillRect(0, groundY + 16, groundW, this.groundHeight - 16);

    this.ctx.fillStyle = '#ba9c59';
    for (let x = -24; x < groundW + 24; x += 18) {
      const drawX = x - this.groundOffset;
      this.ctx.beginPath();
      this.ctx.moveTo(drawX, groundY + 16);
      this.ctx.lineTo(drawX + 8, groundY + 16);
      this.ctx.lineTo(drawX - 2, groundY + 36);
      this.ctx.lineTo(drawX - 10, groundY + 36);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  drawParticles() {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
