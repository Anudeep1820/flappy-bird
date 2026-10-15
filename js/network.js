/**
 * Multiplayer Network Coordinator for Flappy Bird
 * Dual Engine:
 * 1. WebRTC Cloud P2P Mesh (Zero-config, works 100% on Vercel out of the box)
 * 2. Dedicated Socket.io server mode (if running node server/index.js locally or on Render/Railway)
 */

export class NetworkManager {
  constructor() {
    this.mode = 'P2P'; // 'P2P' or 'SOCKET'
    this.socket = null;
    this.peer = null;
    this.hostConn = null; // Guest's connection to the host
    this.peerConnections = new Map(); // Host's connections to all guests: peerId -> DataConnection
    this.isConnected = false;

    this.serverUrl = localStorage.getItem('flappy_mp_server') || '';

    this.currentRoom = null;
    this.remotePlayers = new Map(); // id -> remote player state
    this.myId = null;

    // 20Hz transmission limiter
    this.lastSendTime = 0;
    this.sendInterval = 1000 / 22; // ~22Hz

    // Event callbacks
    this.onGameStarted = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onHostChanged = null;
    this.onStatusChanged = null;
    this.onMatchFinished = null;

    // Match tracking
    this.myDead = false;
    this.myFinalScore = 0;

    this.init();
  }

  init() {
    // If a custom socket server URL was specified by user, try Socket.io first
    if (this.serverUrl && this.serverUrl.startsWith('http')) {
      this.initSocketIo();
    } else {
      this.initP2P();
    }
  }

  initP2P() {
    this.mode = 'P2P';
    if (typeof window.Peer !== 'function') {
      console.warn('[Multiplayer] PeerJS library not yet loaded. Will retry on demand.');
      if (this.onStatusChanged) this.onStatusChanged(false, 'PeerJS loading...');
      return;
    }

    this.isConnected = true;
    if (this.onStatusChanged) {
      this.onStatusChanged(true, 'Cloud P2P Ready');
    }
  }

  initSocketIo() {
    if (typeof window.io !== 'function') {
      this.initP2P();
      return;
    }

    try {
      this.mode = 'SOCKET';
      this.socket = window.io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 4000,
        reconnectionAttempts: 2
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.myId = this.socket.id;
        if (this.onStatusChanged) this.onStatusChanged(true, 'Socket.io Server');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        if (this.onStatusChanged) this.onStatusChanged(false, 'Disconnected');
      });

      this.socket.on('connect_error', () => {
        // Fallback to P2P automatically if socket server isn't reachable
        console.log('[Multiplayer] Socket.io unreachable, falling back to WebRTC P2P Cloud mode');
        this.socket.disconnect();
        this.socket = null;
        this.initP2P();
      });

      // Socket.io room events
      this.socket.on('player_joined', (player) => {
        if (player.id !== this.myId) {
          this.addRemotePlayer(player);
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

      this.socket.on('remote_player_update', (data) => {
        if (data.id === this.myId) return;
        this.handleRemoteUpdate(data);
      });

      this.socket.on('remote_player_action', (data) => {
        if (data.id === this.myId) return;
        this.handleRemoteAction(data);
      });
    } catch {
      this.initP2P();
    }
  }

  setServerUrl(url) {
    if (!url) {
      localStorage.removeItem('flappy_mp_server');
      this.serverUrl = '';
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.initP2P();
      return;
    }

    this.serverUrl = url.trim();
    localStorage.setItem('flappy_mp_server', this.serverUrl);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.initSocketIo();
  }

  ensureReady() {
    if (this.mode === 'P2P' && !this.isConnected) {
      this.initP2P();
    }
  }

  async fetchPublicRooms() {
    try {
      // 1. If using Socket.io mode and connected
      if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
        return new Promise((resolve) => {
          this.socket.emit('list_rooms', (rooms) => resolve(rooms || []));
          setTimeout(() => resolve([]), 2000);
        });
      }

      // 2. Default: Fetch from serverless /api/rooms
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const rooms = await res.json();
        return Array.isArray(rooms) ? rooms : [];
      }
    } catch {
      // Fallback
    }
    return [];
  }

  /**
   * Helper to generate unique 5-char code
   */
  generateCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * CREATE ROOM
   */
  async createRoom({ name, isPrivate, password, skin }) {
    this.ensureReady();

    // 1. Socket.io mode if connected
    if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
      return new Promise((resolve, reject) => {
        this.socket.emit('create_room', { name, isPrivate, password, skin }, (response) => {
          if (response && response.success) {
            this.currentRoom = {
              code: response.roomCode,
              seed: response.seed,
              isHost: true,
              isPrivate: Boolean(isPrivate),
              state: response.state
            };
            this.remotePlayers.clear();
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Failed to create room'));
          }
        });
      });
    }

    // 2. WebRTC P2P Cloud Mode
    if (typeof window.Peer !== 'function') {
      throw new Error('WebRTC networking library initializing. Please retry in a second.');
    }

    return new Promise((resolve, reject) => {
      this.leaveRoom();

      const code = this.generateCode();
      const seed = Math.floor(Math.random() * 900000) + 100000;
      const peerId = `flappy-bird-${code}`;

      try {
        this.peer = new window.Peer(peerId, {
          debug: 0
        });

        const timeout = setTimeout(() => {
          reject(new Error('Connection timed out. Please retry.'));
        }, 9000);

        this.peer.on('open', (id) => {
          clearTimeout(timeout);
          this.myId = id;
          this.currentRoom = {
            code,
            seed,
            isHost: true,
            isPrivate: Boolean(isPrivate),
            password: password ? String(password).trim() : null,
            state: 'WAITING'
          };
          this.remotePlayers.clear();
          this.peerConnections.clear();

          // Register in public discovery if public
          if (!isPrivate) {
            fetch('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'register',
                code,
                hostName: name || 'Host',
                playerCount: 1,
                state: 'WAITING'
              })
            }).catch(() => {});
          }

          resolve({
            success: true,
            roomCode: code,
            seed,
            isHost: true,
            state: 'WAITING'
          });
        });

        // Listen for incoming guest connections (Host Star Relay)
        this.peer.on('connection', (conn) => {
          this.setupHostGuestConnection(conn, name);
        });

        this.peer.on('error', (err) => {
          clearTimeout(timeout);
          if (err.type === 'unavailable-id') {
            // Collision retry
            this.createRoom({ name, isPrivate, password, skin }).then(resolve).catch(reject);
          } else {
            reject(new Error(err.message || 'P2P initialization error'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  setupHostGuestConnection(conn, hostName) {
    conn.on('open', () => {
      // Waiting for join_handshake
    });

    conn.on('data', (data) => {
      if (!data) return;

      if (data.type === 'join_handshake') {
        // Validate password if private
        if (this.currentRoom.isPrivate && this.currentRoom.password) {
          if (!data.password || data.password.trim() !== this.currentRoom.password) {
            conn.send({ type: 'join_rejected', error: 'Incorrect room password.' });
            setTimeout(() => conn.close(), 200);
            return;
          }
        }

        // Accept Guest
        this.peerConnections.set(conn.peer, conn);

        const newPlayer = {
          id: conn.peer,
          name: data.name || 'Player',
          skin: data.skin || null,
          x: 75,
          y: 260,
          vy: 0,
          rotation: 0,
          wingPhase: 0,
          isDead: false,
          score: 0,
          powers: {},
          isHost: false
        };

        this.addRemotePlayer(newPlayer);

        // Send acceptance with seed and current players
        conn.send({
          type: 'join_accepted',
          roomCode: this.currentRoom.code,
          seed: this.currentRoom.seed,
          state: this.currentRoom.state,
          players: [
            {
              id: this.myId,
              name: hostName || 'Host',
              isHost: true
            },
            ...Array.from(this.remotePlayers.values())
          ]
        });

        // Broadcast to all other guests
        this.broadcastToGuests({
          type: 'player_joined',
          player: newPlayer
        }, conn.peer);

        if (this.onPlayerJoined) {
          this.onPlayerJoined(newPlayer);
        }

        // Update public room count
        if (!this.currentRoom.isPrivate) {
          fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              code: this.currentRoom.code,
              hostName: hostName || 'Host',
              playerCount: this.peerConnections.size + 1,
              state: this.currentRoom.state
            })
          }).catch(() => {});
        }
      } else if (data.type === 'player_update') {
        // Guest position update -> relay to other guests
        this.handleRemoteUpdate(data);
        this.broadcastToGuests({
          type: 'remote_player_update',
          ...data
        }, conn.peer);
      } else if (data.type === 'player_action') {
        this.handleRemoteAction(data);
        this.broadcastToGuests({
          type: 'remote_player_action',
          ...data
        }, conn.peer);
      }
    });

    conn.on('close', () => {
      this.peerConnections.delete(conn.peer);
      this.remotePlayers.delete(conn.peer);
      this.broadcastToGuests({
        type: 'player_left',
        id: conn.peer
      });
      if (this.onPlayerLeft) this.onPlayerLeft(conn.peer);
    });
  }

  broadcastToGuests(payload, excludePeerId = null) {
    for (const [id, conn] of this.peerConnections.entries()) {
      if (id !== excludePeerId && conn.open) {
        conn.send(payload);
      }
    }
  }

  /**
   * JOIN ROOM
   */
  async joinRoom({ roomCode, password, name, skin }) {
    this.ensureReady();
    const code = (roomCode || '').toUpperCase().trim();

    // 1. Socket.io mode if connected
    if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
      return new Promise((resolve, reject) => {
        this.socket.emit('join_room', { roomCode: code, password, name, skin }, (response) => {
          if (response && response.success) {
            this.currentRoom = {
              code: response.roomCode,
              seed: response.seed,
              isHost: response.isHost,
              state: response.state
            };
            this.remotePlayers.clear();

            if (Array.isArray(response.players)) {
              response.players.forEach(p => {
                if (p.id !== this.myId) this.addRemotePlayer(p);
              });
            }

            resolve(response);
          } else {
            reject(new Error(response?.error || 'Failed to join room'));
          }
        });
      });
    }

    // 2. WebRTC P2P Cloud Mode
    if (typeof window.Peer !== 'function') {
      throw new Error('WebRTC networking initializing. Please retry in a moment.');
    }

    return new Promise((resolve, reject) => {
      this.leaveRoom();

      try {
        this.peer = new window.Peer({ debug: 0 });

        const targetPeerId = `flappy-bird-${code}`;
        let timeout = setTimeout(() => {
          reject(new Error('Room not found. Check code or ensure host is online.'));
        }, 9000);

        this.peer.on('open', (myId) => {
          this.myId = myId;
          const conn = this.peer.connect(targetPeerId, { reliable: true });
          this.hostConn = conn;

          conn.on('open', () => {
            clearTimeout(timeout);
            // Send join handshake
            conn.send({
              type: 'join_handshake',
              name,
              password,
              skin
            });
          });

          conn.on('data', (data) => {
            if (!data) return;

            if (data.type === 'join_accepted') {
              this.currentRoom = {
                code: data.roomCode,
                seed: data.seed,
                isHost: false,
                state: data.state
              };
              this.remotePlayers.clear();

              if (Array.isArray(data.players)) {
                data.players.forEach(p => {
                  if (p.id !== this.myId) this.addRemotePlayer(p);
                });
              }

              resolve({
                success: true,
                roomCode: code,
                seed: data.seed,
                isHost: false
              });
            } else if (data.type === 'join_rejected') {
              clearTimeout(timeout);
              reject(new Error(data.error || 'Join rejected'));
            } else if (data.type === 'player_joined') {
              this.addRemotePlayer(data.player);
              if (this.onPlayerJoined) this.onPlayerJoined(data.player);
            } else if (data.type === 'player_left') {
              this.remotePlayers.delete(data.id);
              if (this.onPlayerLeft) this.onPlayerLeft(data.id);
            } else if (data.type === 'game_started') {
              if (this.currentRoom) {
                this.currentRoom.seed = data.seed;
                this.currentRoom.state = 'PLAYING';
              }
              this.myDead = false;
              this.myFinalScore = 0;
              for (const p of this.remotePlayers.values()) {
                p.isDead = false;
                p.score = 0;
              }
              if (this.onGameStarted) this.onGameStarted(data);
            } else if (data.type === 'remote_player_update') {
              this.handleRemoteUpdate(data);
            } else if (data.type === 'remote_player_action') {
              this.handleRemoteAction(data);
            }
          });

          conn.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error('Connection to host failed.'));
          });

          conn.on('close', () => {
            this.leaveRoom();
            if (this.onHostChanged) this.onHostChanged(null);
          });
        });

        this.peer.on('error', (err) => {
          clearTimeout(timeout);
          if (err.type === 'peer-unavailable') {
            reject(new Error(`Room "${code}" not found. Ensure host created room.`));
          } else {
            reject(new Error(err.message || 'Network error'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  addRemotePlayer(player) {
    this.remotePlayers.set(player.id, {
      ...player,
      targetY: player.y || 260,
      targetRotation: player.rotation || 0,
      smoothY: player.y || 260,
      smoothRot: player.rotation || 0
    });
  }

  handleRemoteUpdate(data) {
    let p = this.remotePlayers.get(data.id);
    if (!p) {
      this.addRemotePlayer(data);
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
  }

  handleRemoteAction(data) {
    if (!data) return;
    if (data.action === 'die') {
      const p = this.remotePlayers.get(data.id);
      if (p) {
        p.isDead = true;
        if (typeof data.score === 'number') p.score = data.score;
      }
      this.checkMatchFinished();
    }
  }

  checkMatchFinished() {
    if (!this.currentRoom || this.currentRoom.state !== 'PLAYING') return;

    // Check if local player is dead
    if (!this.myDead) return;

    // Check if all remote players are dead
    for (const p of this.remotePlayers.values()) {
      if (!p.isDead) return; // Rival still flying!
    }

    // All players dead! Complete match
    this.currentRoom.state = 'FINISHED';

    const myName = localStorage.getItem('flappy_player_name') || 'You';
    const rankings = [
      {
        id: this.myId,
        name: myName,
        score: this.myFinalScore || 0,
        isMe: true,
        isHost: this.currentRoom.isHost
      },
      ...Array.from(this.remotePlayers.values()).map(p => ({
        id: p.id,
        name: p.name || 'Player',
        score: p.score || 0,
        isMe: false,
        isHost: p.isHost
      }))
    ];

    rankings.sort((a, b) => b.score - a.score);

    if (this.onMatchFinished) {
      this.onMatchFinished({
        rankings,
        isHost: this.currentRoom.isHost,
        roomCode: this.currentRoom.code
      });
    }
  }

  requestStartGame() {
    return new Promise((resolve, reject) => {
      if (!this.currentRoom) return reject(new Error('Not in a room'));

      const seed = Math.floor(Math.random() * 900000) + 100000;
      this.currentRoom.seed = seed;
      this.currentRoom.state = 'PLAYING';

      this.myDead = false;
      this.myFinalScore = 0;
      for (const p of this.remotePlayers.values()) {
        p.isDead = false;
        p.score = 0;
      }

      // 1. Socket.io mode
      if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
        this.socket.emit('start_game', (res) => {
          if (res && res.success) resolve(res);
          else reject(new Error(res?.error || 'Failed to start'));
        });
        return;
      }

      // 2. P2P Host broadcast
      if (this.currentRoom.isHost) {
        this.broadcastToGuests({
          type: 'game_started',
          seed
        });
        if (this.onGameStarted) this.onGameStarted({ seed });
        resolve({ success: true, seed });
      } else {
        reject(new Error('Only the host can launch the match'));
      }
    });
  }

  leaveRoom() {
    if (this.mode === 'SOCKET' && this.socket && this.currentRoom) {
      this.socket.emit('leave_room');
    }

    if (this.currentRoom && this.currentRoom.isHost && !this.currentRoom.isPrivate) {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unregister', code: this.currentRoom.code })
      }).catch(() => {});
    }

    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }

    for (const conn of this.peerConnections.values()) {
      try { conn.close(); } catch {}
    }
    this.peerConnections.clear();

    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }

    this.currentRoom = null;
    this.remotePlayers.clear();
  }

  sendUpdate(playerState) {
    if (!this.currentRoom) return;

    const now = performance.now();
    if (now - this.lastSendTime < this.sendInterval) return;
    this.lastSendTime = now;

    // Socket.io mode
    if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
      this.socket.emit('player_update', playerState);
      return;
    }

    // P2P mode
    const payload = {
      id: this.myId,
      ...playerState
    };

    if (this.currentRoom.isHost) {
      this.broadcastToGuests({
        type: 'remote_player_update',
        ...payload
      });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({
        type: 'player_update',
        ...payload
      });
    }
  }

  sendAction(actionType, extraData = {}) {
    if (!this.currentRoom) return;

    if (actionType === 'die') {
      this.myDead = true;
      this.myFinalScore = typeof extraData.score === 'number' ? extraData.score : 0;
      setTimeout(() => this.checkMatchFinished(), 60);
    }

    if (this.mode === 'SOCKET' && this.socket && this.socket.connected) {
      this.socket.emit('player_action', { action: actionType, ...extraData });
      return;
    }

    const payload = {
      id: this.myId,
      action: actionType,
      ...extraData
    };

    if (this.currentRoom.isHost) {
      this.broadcastToGuests({
        type: 'remote_player_action',
        ...payload
      });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({
        type: 'player_action',
        ...payload
      });
    }
  }

  updateRemotePlayers(dt) {
    for (const p of this.remotePlayers.values()) {
      if (typeof p.targetY === 'number') {
        p.smoothY = p.smoothY !== undefined ? p.smoothY + (p.targetY - p.smoothY) * 0.4 : p.targetY;
        p.y = p.smoothY;
      }
      if (typeof p.targetRotation === 'number') {
        p.smoothRot = p.smoothRot !== undefined ? p.smoothRot + (p.targetRotation - p.smoothRot) * 0.4 : p.targetRotation;
        p.rotation = p.smoothRot;
      }
    }
  }

  drawRemotePlayers(ctx, birdRenderer) {
    for (const p of this.remotePlayers.values()) {
      ctx.save();

      // Translucent ghost appearance
      ctx.globalAlpha = p.isDead ? 0.22 : 0.48;

      birdRenderer.drawGhostBird(ctx, {
        x: p.x || 75,
        y: p.y || 260,
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
      const tagY = (p.y || 260) - 20;

      const nameText = p.name || 'Player';
      const textWidth = ctx.measureText(nameText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(tagX - textWidth / 2 - 4, tagY - 8, textWidth + 8, 12, 3);
      ctx.fill();

      ctx.fillStyle = p.isDead ? '#94a3b8' : '#38bdf8';
      ctx.fillText(nameText, tagX, tagY);

      if (p.powers && p.powers.shield) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText('🛡️', tagX + textWidth / 2 + 8, tagY);
      }

      ctx.restore();
    }
  }
}
