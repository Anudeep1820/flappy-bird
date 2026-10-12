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
import { CoinManager, createMulberry32 } from './coins.js';
import { PowerManager } from './powers.js';
import { NetworkManager } from './network.js';

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

    // Coins & Powers UI
    this.coinCountVal = document.getElementById('coin-count-val');
    this.finalCoinsEl = document.getElementById('final-coins');

    // Multiplayer UI
    this.mpBtnTop = document.getElementById('multiplayer-btn-top');
    this.mpBtnOver = document.getElementById('mp-btn-over');
    this.mpModal = document.getElementById('mp-modal');
    this.mpCloseBtn = document.getElementById('mp-close-btn');
    this.mpStatusPill = document.getElementById('mp-server-status-pill');
    this.mpLobbyView = document.getElementById('mp-lobby-view');
    this.mpCreateView = document.getElementById('mp-create-view');
    this.mpRoomView = document.getElementById('mp-room-view');
    this.mpRoomsList = document.getElementById('mp-rooms-list');
    this.mpRefreshRoomsBtn = document.getElementById('mp-refresh-rooms-btn');
    this.mpOpenCreateBtn = document.getElementById('mp-open-create-btn');
    this.mpCancelCreateBtn = document.getElementById('mp-cancel-create-btn');
    this.mpConfirmCreateBtn = document.getElementById('mp-confirm-create-btn');
    this.mpPrivateCheckbox = document.getElementById('mp-private-checkbox');
    this.mpCreatePassRow = document.getElementById('mp-create-pass-row');
    this.mpCreatePassInput = document.getElementById('mp-create-pass-input');
    this.mpCodeInput = document.getElementById('mp-code-input');
    this.mpPassInput = document.getElementById('mp-pass-input');
    this.mpJoinSubmitBtn = document.getElementById('mp-join-submit-btn');
    this.mpLobbyMsg = document.getElementById('mp-lobby-msg');
    this.mpCreateMsg = document.getElementById('mp-create-msg');
    this.mpRoomCodeVal = document.getElementById('mp-room-code-val');
    this.mpCopyCodeBtn = document.getElementById('mp-copy-code-btn');
    this.mpPlayerCount = document.getElementById('mp-player-count');
    this.mpPlayersList = document.getElementById('mp-players-list');
    this.mpStartMatchBtn = document.getElementById('mp-start-match-btn');
    this.mpWaitingHint = document.getElementById('mp-waiting-hint');
    this.mpLeaveRoomBtn = document.getElementById('mp-leave-room-btn');
    this.mpToggleServerSettings = document.getElementById('mp-toggle-server-settings');
    this.mpServerSettingsBox = document.getElementById('mp-server-settings-box');
    this.mpServerUrlInput = document.getElementById('mp-server-url-input');
    this.mpSaveServerBtn = document.getElementById('mp-save-server-btn');

    // States: 'IDLE', 'PLAYING', 'PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS', 'PAUSED_MP', 'GAMEOVER'
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

    // Coins System
    this.coinManager = new CoinManager(this.width, this.height);
    this.coinManager.setCallbacks({
      onCoinPickup: (runCoins, totalCoins) => {
        this.updateCoinDisplay(totalCoins);
      },
      spawnParticleCb: (x, y) => {
        this.spawnScoreBurst(x, y);
      }
    });
    this.updateCoinDisplay(this.coinManager.totalCoins);

    // Superpowers System
    this.powers = new PowerManager();
    this.powers.setCoinManager(this.coinManager);
    this.powers.setChangeCallback((summary) => {
      if (this.network && this.network.currentRoom) {
        this.network.sendAction('power_change', summary);
      }
    });

    // Pipe Spawning Hook: Centered Gold Coin Spawning
    this.pipes.setOnSpawnPair((x, gapCenter, pipeWidth) => {
      const rand = this.currentPrng ? this.currentPrng() : Math.random();
      if (rand < 0.75) {
        this.coinManager.spawnCoinAt(x, gapCenter);
      }
    });

    // Skins Manager
    this.skinsManager = new SkinsManager({
      onSkinChange: (skin) => this.bird.setSkin(skin),
      onOpen: () => this.handleSkinsOpen(),
      onClose: () => this.handleSkinsClose()
    });
    this.bird.setSkin(this.skinsManager.getActiveSkin());

    // Multiplayer Networking
    this.network = new NetworkManager();
    this.setupNetwork();

    // Visuals & Parallax
    this.groundOffset = 0;
    this.cloudOffset = 0;
    this.cityOffset = 0;
    this.shakeFrames = 0;
    this.particles = [];

    // PRNG Seed
    this.currentSeed = Math.floor(Math.random() * 900000) + 100000;
    this.currentPrng = createMulberry32(this.currentSeed);
    this.pipes.setPrng(this.currentPrng);

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
        if (this.state === 'PAUSED_MP') this.closeMultiplayerModal();
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
      if (['PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS', 'PAUSED_MP'].includes(this.state)) return;
      if (e.target.closest('#diag-modal') || e.target.closest('#leaderboard-modal') || e.target.closest('#submit-modal') || e.target.closest('#skins-modal') || e.target.closest('#mp-modal')) return;
      if (e.target.closest('#top-bar-overlay')) return;
      if (e.target.closest('#powers-hud')) return;
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

    // 7. Multiplayer Arena Modal Triggers
    if (this.mpBtnTop) {
      this.mpBtnTop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMultiplayerModal();
      });
    }
    if (this.mpBtnOver) {
      this.mpBtnOver.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMultiplayerModal();
      });
    }
    if (this.mpCloseBtn) {
      this.mpCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMultiplayerModal();
      });
    }

    // 8. Responsive Resize & Orientation Change
    const handleResize = () => {
      this.setupDPI();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100);
    });
  }

  updateCoinDisplay(totalCoins) {
    if (this.coinCountVal) {
      this.coinCountVal.textContent = totalCoins.toString();
    }
    if (this.powers) {
      this.powers.updateHUDDisplay();
    }
  }

  handleActionInput() {
    if (this.state === 'IDLE') {
      this.startGame();
      this.bird.flap();
      sound.playFlap();
      this.spawnFeathers(this.bird.x, this.bird.y);
      if (this.network && this.network.currentRoom) {
        this.network.sendAction('flap', { y: this.bird.y });
      }
    } else if (this.state === 'PLAYING') {
      this.bird.flap();
      sound.playFlap();
      this.spawnFeathers(this.bird.x, this.bird.y);
      if (this.network && this.network.currentRoom) {
        this.network.sendAction('flap', { y: this.bird.y });
      }
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

  handleMpOpen() {
    this.previousState = this.state;
    this.state = 'PAUSED_MP';
  }

  handleMpClose() {
    this.state = this.previousState;
    this.lastTime = performance.now();
  }

  openMultiplayerModal() {
    this.handleMpOpen();
    if (this.mpModal) this.mpModal.classList.remove('hidden');

    this.network.ensureReady();
    if (this.mpStatusPill) {
      const isOnline = this.network.isConnected;
      this.mpStatusPill.className = `mp-status-pill ${isOnline ? 'online' : 'offline'}`;
      this.mpStatusPill.textContent = isOnline ? (this.network.mode === 'P2P' ? '● P2P CLOUD' : '● SOCKET.IO') : '○ OFFLINE';
    }

    if (this.network.currentRoom) {
      this.switchMpView('room');
      this.renderRoomPlayers();
    } else {
      this.switchMpView('lobby');
      this.loadPublicRooms();
    }
  }

  closeMultiplayerModal() {
    if (this.mpModal) this.mpModal.classList.add('hidden');
    this.handleMpClose();
  }

  switchMpView(view) {
    if (this.mpLobbyView) this.mpLobbyView.classList.toggle('hidden', view !== 'lobby');
    if (this.mpCreateView) this.mpCreateView.classList.toggle('hidden', view !== 'create');
    if (this.mpRoomView) this.mpRoomView.classList.toggle('hidden', view !== 'room');
  }

  async loadPublicRooms() {
    if (!this.mpRoomsList) return;
    this.mpRoomsList.innerHTML = `<div class="mp-empty-rooms">Fetching active public rooms...</div>`;

    const rooms = await this.network.fetchPublicRooms();
    if (!rooms || rooms.length === 0) {
      this.mpRoomsList.innerHTML = `<div class="mp-empty-rooms">No public rooms active. Create one!</div>`;
      return;
    }

    this.mpRoomsList.innerHTML = rooms.map(r => `
      <div class="mp-room-item" data-code="${r.code}">
        <div>
          <span class="mp-room-code-tag">${r.code}</span>
          <span class="mp-room-host"> Host: ${r.hostName || 'Player'}</span>
        </div>
        <span class="mp-room-players-count">👥 ${r.playerCount} • ${r.state}</span>
      </div>
    `).join('');

    // Wire room item quick join
    this.mpRoomsList.querySelectorAll('.mp-room-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code');
        if (code) {
          if (this.mpCodeInput) this.mpCodeInput.value = code;
          this.handleJoinRoomSubmit(code);
        }
      });
    });
  }

  renderRoomPlayers() {
    if (!this.network.currentRoom) return;

    if (this.mpRoomCodeVal) {
      this.mpRoomCodeVal.textContent = this.network.currentRoom.code;
    }

    const players = [
      {
        id: this.network.myId,
        name: localStorage.getItem('flappy_player_name') || 'You',
        isHost: this.network.currentRoom.isHost,
        skin: this.bird.skin,
        isMe: true
      },
      ...Array.from(this.network.remotePlayers.values())
    ];

    if (this.mpPlayerCount) {
      this.mpPlayerCount.textContent = players.length.toString();
    }

    if (this.mpPlayersList) {
      this.mpPlayersList.innerHTML = players.map(p => `
        <div class="mp-player-row">
          <span class="mp-player-badge">${p.isMe ? '⭐ ' : '👤 '}${this.escapeHtml(p.name || 'Player')}</span>
          <span class="mp-player-host">${p.isHost ? '👑 HOST' : 'READY'}</span>
        </div>
      `).join('');
    }

    // Host controls
    const isHost = this.network.currentRoom.isHost;
    if (this.mpStartMatchBtn) this.mpStartMatchBtn.classList.toggle('hidden', !isHost);
    if (this.mpWaitingHint) this.mpWaitingHint.classList.toggle('hidden', isHost);
  }

  setupNetwork() {
    // Network status pill hook
    this.network.onStatusChanged = (online, errMsg) => {
      if (this.mpStatusPill) {
        this.mpStatusPill.className = `mp-status-pill ${online ? 'online' : 'offline'}`;
        this.mpStatusPill.textContent = online ? (this.network.mode === 'P2P' ? '● P2P CLOUD' : '● SOCKET.IO') : '○ OFFLINE';
      }
    };

    this.network.onPlayerJoined = () => {
      this.renderRoomPlayers();
    };

    this.network.onPlayerLeft = () => {
      this.renderRoomPlayers();
    };

    this.network.onHostChanged = () => {
      this.renderRoomPlayers();
    };

    // Synchronized Game Start Trigger
    this.network.onGameStarted = ({ seed }) => {
      this.currentSeed = seed;
      this.currentPrng = createMulberry32(seed);
      this.pipes.setPrng(this.currentPrng);

      this.closeMultiplayerModal();
      this.restartGame();
      this.startGame();
    };

    // Wire Multiplayer UI Buttons
    if (this.mpOpenCreateBtn) {
      this.mpOpenCreateBtn.addEventListener('click', () => {
        this.switchMpView('create');
      });
    }

    if (this.mpCancelCreateBtn) {
      this.mpCancelCreateBtn.addEventListener('click', () => {
        this.switchMpView('lobby');
        this.loadPublicRooms();
      });
    }

    if (this.mpRefreshRoomsBtn) {
      this.mpRefreshRoomsBtn.addEventListener('click', () => {
        this.loadPublicRooms();
      });
    }

    if (this.mpPrivateCheckbox) {
      this.mpPrivateCheckbox.addEventListener('change', (e) => {
        if (this.mpCreatePassRow) {
          this.mpCreatePassRow.classList.toggle('hidden', !e.target.checked);
        }
      });
    }

    if (this.mpConfirmCreateBtn) {
      this.mpConfirmCreateBtn.addEventListener('click', () => {
        this.handleCreateRoomSubmit();
      });
    }

    if (this.mpJoinSubmitBtn) {
      this.mpJoinSubmitBtn.addEventListener('click', () => {
        const code = this.mpCodeInput ? this.mpCodeInput.value.trim().toUpperCase() : '';
        this.handleJoinRoomSubmit(code);
      });
    }

    if (this.mpStartMatchBtn) {
      this.mpStartMatchBtn.addEventListener('click', () => {
        this.startMultiplayerMatch();
      });
    }

    if (this.mpLeaveRoomBtn) {
      this.mpLeaveRoomBtn.addEventListener('click', () => {
        this.network.leaveRoom();
        this.switchMpView('lobby');
        this.loadPublicRooms();
      });
    }

    if (this.mpCopyCodeBtn) {
      this.mpCopyCodeBtn.addEventListener('click', () => {
        if (this.network.currentRoom) {
          navigator.clipboard?.writeText(this.network.currentRoom.code).catch(() => {});
          this.mpCopyCodeBtn.textContent = 'COPIED!';
          setTimeout(() => { if (this.mpCopyCodeBtn) this.mpCopyCodeBtn.textContent = '📋 COPY'; }, 1500);
        }
      });
    }

    if (this.mpToggleServerSettings) {
      this.mpToggleServerSettings.addEventListener('click', () => {
        if (this.mpServerSettingsBox) {
          this.mpServerSettingsBox.classList.toggle('hidden');
          if (this.mpServerUrlInput) this.mpServerUrlInput.value = this.network.serverUrl;
        }
      });
    }

    if (this.mpSaveServerBtn) {
      this.mpSaveServerBtn.addEventListener('click', () => {
        const url = this.mpServerUrlInput ? this.mpServerUrlInput.value.trim() : '';
        if (url) {
          this.network.setServerUrl(url);
          this.loadPublicRooms();
        }
      });
    }
  }

  async handleCreateRoomSubmit() {
    const isPrivate = this.mpPrivateCheckbox ? this.mpPrivateCheckbox.checked : false;
    const password = this.mpCreatePassInput ? this.mpCreatePassInput.value.trim() : null;
    const playerName = localStorage.getItem('flappy_player_name') || 'Player 1';

    if (this.mpCreateMsg) {
      this.mpCreateMsg.textContent = 'Creating room...';
      this.mpCreateMsg.style.color = '#38bdf8';
    }

    try {
      const res = await this.network.createRoom({
        name: playerName,
        isPrivate,
        password,
        skin: this.bird.skin
      });

      this.currentSeed = res.seed;
      this.currentPrng = createMulberry32(res.seed);
      this.pipes.setPrng(this.currentPrng);

      if (this.mpCreateMsg) this.mpCreateMsg.textContent = '';
      this.switchMpView('room');
      this.renderRoomPlayers();
    } catch (err) {
      if (this.mpCreateMsg) {
        this.mpCreateMsg.textContent = err.message || 'Creation failed.';
        this.mpCreateMsg.style.color = '#f87171';
      }
    }
  }

  async handleJoinRoomSubmit(code) {
    if (!code) {
      if (this.mpLobbyMsg) {
        this.mpLobbyMsg.textContent = 'Please enter a 5-digit room code.';
        this.mpLobbyMsg.style.color = '#f87171';
      }
      return;
    }

    const password = this.mpPassInput ? this.mpPassInput.value.trim() : null;
    const playerName = localStorage.getItem('flappy_player_name') || 'Player';

    if (this.mpLobbyMsg) {
      this.mpLobbyMsg.textContent = 'Joining room...';
      this.mpLobbyMsg.style.color = '#38bdf8';
    }

    try {
      const res = await this.network.joinRoom({
        roomCode: code,
        password,
        name: playerName,
        skin: this.bird.skin
      });

      this.currentSeed = res.seed;
      this.currentPrng = createMulberry32(res.seed);
      this.pipes.setPrng(this.currentPrng);

      if (this.mpLobbyMsg) this.mpLobbyMsg.textContent = '';
      this.switchMpView('room');
      this.renderRoomPlayers();
    } catch (err) {
      if (this.mpLobbyMsg) {
        this.mpLobbyMsg.textContent = err.message || 'Failed to join.';
        this.mpLobbyMsg.style.color = '#f87171';
      }
    }
  }

  async startMultiplayerMatch() {
    try {
      await this.network.requestStartGame();
    } catch (err) {
      console.warn('Match launch error:', err);
    }
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

    if (this.finalCoinsEl) {
      this.finalCoinsEl.textContent = `+${this.coinManager.runCoins}`;
    }

    if (this.network && this.network.currentRoom) {
      this.network.sendAction('die', { y: this.bird.y, score: this.score });
    }

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
    this.coinManager.reset();
    this.powers.reset();
    this.particles = [];

    // Reset PRNG seed (fresh seed for solo, synchronized room seed for multiplayer)
    if (!this.network || !this.network.currentRoom) {
      this.currentSeed = Math.floor(Math.random() * 900000) + 100000;
    }
    this.currentPrng = createMulberry32(this.currentSeed);
    this.pipes.setPrng(this.currentPrng);

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
    if (['PAUSED_DIAG', 'PAUSED_LEADERBOARD', 'PAUSED_SUBMIT', 'PAUSED_SKINS', 'PAUSED_MP'].includes(this.state)) return;

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
      this.powers.update(dt);
      this.bird.update(dt, Flags);
      this.coinManager.update(dt, this.bird, scrollDelta, this.powers);

      this.pipes.update(dt, Flags, this.bird, () => {
        const scoreIncr = this.powers.isMultiplierActive() ? 2 : 1;
        this.score += scoreIncr;
        if (this.hudScore) this.hudScore.textContent = this.score;
        sound.playScore();
        this.spawnScoreBurst(this.bird.x + 20, this.bird.y);
      });

      // Collision Check with shield invulnerability
      if (this.pipes.checkCollision(this.bird, Flags, this.powers)) {
        this.gameOver();
      }

      // 20Hz Multiplayer Network broadcast
      if (this.network && this.network.currentRoom) {
        this.network.sendUpdate({
          y: this.bird.y,
          vy: this.bird.velocity,
          rotation: this.bird.rotation,
          wingPhase: this.bird.wingPhase,
          isDead: this.bird.isDead,
          score: this.score,
          powers: this.powers.getActiveSummary(),
          skin: this.bird.skin
        });
      }
    }

    // Smooth remote peers update
    if (this.network && this.network.currentRoom) {
      this.network.updateRemotePlayers(dt);
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

    // 4.5. Coins
    this.coinManager.draw(this.ctx);

    // 5. Ground Layer
    this.drawGround();

    // 6. Particles
    this.drawParticles();

    // 6.5. Remote Multiplayer Players (translucent ghost birds)
    if (this.network && this.network.currentRoom) {
      this.network.drawRemotePlayers(this.ctx, this.bird);
    }

    // 7. Bird Entity
    this.bird.draw(this.ctx, Flags, this.powers);

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
