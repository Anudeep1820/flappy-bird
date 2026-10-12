/**
 * Multiplayer Network Coordinator for Flappy Bird
 * Manages Socket.io connection, room lifecycle, 20Hz state synchronization,
 * and remote peer interpolation.
 */

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.serverUrl = localStorage.getItem('flappy_mp_server') || window.location.origin;

    // Fallback if origin is file or non-http
    if (!this.serverUrl.startsWith('http')) {
      this.serverUrl = 'http://localhost:3001';
    }

    this.currentRoom = null;
    this.remotePlayers = new Map(); // id -> remote player state
    this.myId = null;

    // Throttled transmission state
    this.lastSendTime = 0;
    this.sendInterval = 1000 / 22; // ~22Hz

    // Event hooks
    this.onRoomJoined = null;
    this.onGameStarted = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onHostChanged = null;
    this.onStatusChanged = null;
  }

  setServerUrl(url) {
    if (!url) return;
    this.serverUrl = url.trim();
    localStorage.setItem('flappy_mp_server', this.serverUrl);
    if (this.socket) {
      this.socket.disconnect();
      this.connect();
    }
  }

  connect() {
    if (typeof window.io !== 'function') {
      console.warn('[Multiplayer] Socket.io client script not yet loaded.');
      return;
    }

    if (this.socket && this.socket.connected) return;

    try {
      this.socket = window.io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 6000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.myId = this.socket.id;
        if (this.onStatusChanged) this.onStatusChanged(true);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        if (this.onStatusChanged) this.onStatusChanged(false);
      });

      this.socket.on('connect_error', (err) => {
        this.isConnected = false;
        if (this.onStatusChanged) this.onStatusChanged(false, err.message);
      });

      // Room events
      this.socket.on('player_joined', (player) => {
        if (player.id !== this.myId) {
          this.remotePlayers.set(player.id, {
            ...player,
            targetY: player.y,
            targetRotation: player.rotation || 0,
            smoothY: player.y,
            smoothRot: player.rotation || 0
          });
          if (this.onPlayerJoined) this.onPlayerJoined(player);
        }
      });

      this.socket.on('player_left', ({ id }) => {
        this.remotePlayers.delete(id);
        if (this.onPlayerLeft) this.onPlayerLeft(id);
      });

      this.socket.on('host_changed', ({ newHostId }) => {
        if (this.currentRoom) {
          this.currentRoom.isHost = (newHostId === this.myId);
        }
        if (this.onHostChanged) this.onHostChanged(newHostId);
      });

      this.socket.on('game_started', (data) => {
        if (this.currentRoom) {
          this.currentRoom.seed = data.seed;
          this.currentRoom.state = 'PLAYING';
        }
        if (this.onGameStarted) this.onGameStarted(data);
      });

      // Real-time state update from remote player
      this.socket.on('remote_player_update', (data) => {
        if (data.id === this.myId) return;

        let p = this.remotePlayers.get(data.id);
        if (!p) {
          p = {
            id: data.id,
            name: data.name || 'Player',
            skin: data.skin || null,
            x: 75,
            y: data.y,
            vy: data.vy,
            rotation: data.rotation,
            wingPhase: data.wingPhase || 0,
            isDead: Boolean(data.isDead),
            score: data.score || 0,
            powers: data.powers || {},
            targetY: data.y,
            targetRotation: data.rotation,
            smoothY: data.y,
            smoothRot: data.rotation
          };
          this.remotePlayers.set(data.id, p);
        } else {
          p.targetY = data.y;
          p.targetRotation = data.rotation;
          p.vy = data.vy;
          p.wingPhase = data.wingPhase || 0;
          p.isDead = Boolean(data.isDead);
          p.score = data.score || 0;
          p.powers = data.powers || {};
          if (data.skin) p.skin = data.skin;
        }
      });
    } catch (err) {
      console.warn('[Multiplayer] Connection init error:', err);
    }
  }

  ensureConnected() {
    if (!this.socket || !this.isConnected) {
      this.connect();
    }
  }

  fetchPublicRooms() {
    return new Promise((resolve) => {
      this.ensureConnected();
      if (!this.socket) return resolve([]);

      this.socket.emit('list_rooms', (rooms) => {
        resolve(rooms || []);
      });

      // Timeout fallback
      setTimeout(() => resolve([]), 2500);
    });
  }

  createRoom({ name, isPrivate, password, skin }) {
    return new Promise((resolve, reject) => {
      this.ensureConnected();
      if (!this.socket) {
        return reject(new Error('Socket server not reachable.'));
      }

      this.socket.emit('create_room', { name, isPrivate, password, skin }, (response) => {
        if (response && response.success) {
          this.currentRoom = {
            code: response.roomCode,
            seed: response.seed,
            isHost: true,
            state: response.state
          };
          this.remotePlayers.clear();
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to create room.'));
        }
      });
    });
  }

  joinRoom({ roomCode, password, name, skin }) {
    return new Promise((resolve, reject) => {
      this.ensureConnected();
      if (!this.socket) {
        return reject(new Error('Socket server not reachable.'));
      }

      this.socket.emit('join_room', { roomCode, password, name, skin }, (response) => {
        if (response && response.success) {
          this.currentRoom = {
            code: response.roomCode,
            seed: response.seed,
            isHost: response.isHost,
            state: response.state
          };
          this.remotePlayers.clear();

          // Populate existing room players
          if (Array.isArray(response.players)) {
            response.players.forEach(p => {
              if (p.id !== this.myId) {
                this.remotePlayers.set(p.id, {
                  ...p,
                  targetY: p.y,
                  targetRotation: p.rotation || 0,
                  smoothY: p.y,
                  smoothRot: p.rotation || 0
                });
              }
            });
          }

          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to join room.'));
        }
      });
    });
  }

  requestStartGame() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentRoom) return reject(new Error('Not in a room'));

      this.socket.emit('start_game', (res) => {
        if (res && res.success) {
          resolve(res);
        } else {
          reject(new Error(res?.error || 'Failed to start game'));
        }
      });
    });
  }

  leaveRoom() {
    if (this.socket && this.currentRoom) {
      this.socket.emit('leave_room');
    }
    this.currentRoom = null;
    this.remotePlayers.clear();
  }

  sendUpdate(playerState) {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    const now = performance.now();
    if (now - this.lastSendTime < this.sendInterval) return;
    this.lastSendTime = now;

    this.socket.emit('player_update', playerState);
  }

  sendAction(actionType, extraData = {}) {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;
    this.socket.emit('player_action', { action: actionType, ...extraData });
  }

  /**
   * Smooth remote player interpolation step
   */
  updateRemotePlayers(dt) {
    for (const p of this.remotePlayers.values()) {
      // Smooth dampening towards target Y and rotation
      if (typeof p.targetY === 'number') {
        p.smoothY = p.smoothY !== undefined ? p.smoothY + (p.targetY - p.smoothY) * 0.38 : p.targetY;
        p.y = p.smoothY;
      }
      if (typeof p.targetRotation === 'number') {
        p.smoothRot = p.smoothRot !== undefined ? p.smoothRot + (p.targetRotation - p.smoothRot) * 0.38 : p.targetRotation;
        p.rotation = p.smoothRot;
      }
    }
  }

  /**
   * Render all remote peers as translucent ghost birds
   */
  drawRemotePlayers(ctx, birdRenderer) {
    for (const p of this.remotePlayers.values()) {
      ctx.save();

      // Translucent ghost appearance
      ctx.globalAlpha = p.isDead ? 0.22 : 0.48;

      // Draw remote bird at interpolated location
      birdRenderer.drawGhostBird(ctx, {
        x: p.x || 75,
        y: p.y,
        rotation: p.rotation,
        wingPhase: p.wingPhase || 0,
        skin: p.skin,
        isDead: p.isDead,
        powers: p.powers
      });

      // Hovering player name tag
      ctx.globalAlpha = 0.85;
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      const tagX = p.x || 75;
      const tagY = p.y - 20;

      // Tag pill background
      const nameText = p.name || 'Player';
      const textWidth = ctx.measureText(nameText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(tagX - textWidth / 2 - 4, tagY - 8, textWidth + 8, 12, 3);
      ctx.fill();

      // Text label
      ctx.fillStyle = p.isDead ? '#94a3b8' : '#38bdf8';
      ctx.fillText(nameText, tagX, tagY);

      // Active power indicator tag
      if (p.powers && p.powers.shield) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText('🛡️', tagX + textWidth / 2 + 8, tagY);
      }

      ctx.restore();
    }
  }
}
