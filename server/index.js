import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files for standalone deployment (Render / Railway / Local)
const publicDir = path.resolve(__dirname, '..');
app.use(express.static(publicDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// In-Memory Room Storage
const rooms = new Map();

/**
 * Generate unique 5-character room code (avoiding ambiguous chars like 0, O, 1, I)
 */
function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

/**
 * Generate integer PRNG seed for deterministic pipe & coin generation
 */
function generateSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}

/**
 * Format public room summary
 */
function getPublicRooms() {
  const list = [];
  for (const [code, r] of rooms.entries()) {
    if (!r.isPrivate) {
      list.push({
        code,
        hostName: r.players.get(r.hostId)?.name || 'Host',
        playerCount: r.players.size,
        state: r.state
      });
    }
  }
  return list;
}

// REST Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/rooms', (req, res) => {
  res.json(getPublicRooms());
});

// Socket.io Connection & Event Lifecycle
io.on('connection', (socket) => {
  let currentRoomCode = null;

  // 1. Send public room listing
  socket.on('list_rooms', (callback) => {
    if (typeof callback === 'function') {
      callback(getPublicRooms());
    } else {
      socket.emit('rooms_list', getPublicRooms());
    }
  });

  // 2. Create Room
  socket.on('create_room', (data, callback) => {
    try {
      const { name, isPrivate, password, skin } = data || {};
      const code = generateRoomCode();
      const seed = generateSeed();

      const newRoom = {
        code,
        isPrivate: Boolean(isPrivate),
        password: password ? String(password).trim() : null,
        seed,
        hostId: socket.id,
        state: 'WAITING',
        players: new Map(),
        createdAt: Date.now()
      };

      const playerObj = {
        id: socket.id,
        name: (name && String(name).trim().slice(0, 12)) || 'Player 1',
        skin: skin || null,
        x: 75,
        y: 260,
        vy: 0,
        rotation: 0,
        wingPhase: 0,
        isDead: false,
        score: 0,
        powers: {},
        isHost: true
      };

      newRoom.players.set(socket.id, playerObj);
      rooms.set(code, newRoom);
      currentRoomCode = code;

      socket.join(code);

      const responsePayload = {
        success: true,
        roomCode: code,
        seed,
        isHost: true,
        players: Array.from(newRoom.players.values()),
        state: newRoom.state
      };

      if (typeof callback === 'function') {
        callback(responsePayload);
      } else {
        socket.emit('room_created', responsePayload);
      }

      // Broadcast updated public room list
      io.emit('rooms_list', getPublicRooms());
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 3. Join Room
  socket.on('join_room', (data, callback) => {
    try {
      const { roomCode, password, name, skin } = data || {};
      const code = (roomCode || '').toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        const err = { success: false, error: 'Room not found. Check code.' };
        if (typeof callback === 'function') callback(err);
        return;
      }

      // Check password if private
      if (room.isPrivate && room.password) {
        if (!password || password.trim() !== room.password) {
          const err = { success: false, error: 'Incorrect room password.' };
          if (typeof callback === 'function') callback(err);
          return;
        }
      }

      const playerObj = {
        id: socket.id,
        name: (name && String(name).trim().slice(0, 12)) || `Player ${room.players.size + 1}`,
        skin: skin || null,
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

      room.players.set(socket.id, playerObj);
      currentRoomCode = code;

      socket.join(code);

      const responsePayload = {
        success: true,
        roomCode: code,
        seed: room.seed,
        isHost: false,
        players: Array.from(room.players.values()),
        state: room.state
      };

      if (typeof callback === 'function') {
        callback(responsePayload);
      }

      // Notify other players in the room
      socket.to(code).emit('player_joined', playerObj);

      // Broadcast updated public room list
      io.emit('rooms_list', getPublicRooms());
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 4. Start Match (Host Only)
  socket.on('start_game', (callback) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== socket.id) {
      if (typeof callback === 'function') callback({ success: false, error: 'Only host can start match' });
      return;
    }

    // Refresh seed for new match
    room.seed = generateSeed();
    room.state = 'PLAYING';

    // Reset players alive state
    for (const p of room.players.values()) {
      p.isDead = false;
      p.score = 0;
      p.y = 260;
      p.vy = 0;
    }

    const payload = {
      seed: room.seed,
      startTime: Date.now() + 500 // slight countdown offset
    };

    io.to(currentRoomCode).emit('game_started', payload);
    if (typeof callback === 'function') callback({ success: true, ...payload });

    io.emit('rooms_list', getPublicRooms());
  });

  // 5. High-Frequency Player State Relay (~20Hz tick)
  socket.on('player_update', (data) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.y = data.y;
      player.vy = data.vy;
      player.rotation = data.rotation;
      player.wingPhase = data.wingPhase;
      player.isDead = Boolean(data.isDead);
      player.score = data.score || 0;
      player.powers = data.powers || {};
      if (data.skin) player.skin = data.skin;
    }

    // Fast multicast to peers in same room
    socket.to(currentRoomCode).emit('remote_player_update', {
      id: socket.id,
      ...data
    });
  });

  // 6. Action Relay (Flap, Death, Power Triggered)
  socket.on('player_action', (data) => {
    if (!currentRoomCode) return;
    socket.to(currentRoomCode).emit('remote_player_action', {
      id: socket.id,
      ...data
    });
  });

  // 7. Leave Room
  const handleLeaveRoom = () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    socket.leave(currentRoomCode);
    room.players.delete(socket.id);

    // Notify room peers
    socket.to(currentRoomCode).emit('player_left', { id: socket.id });

    // Handle host departure
    if (room.hostId === socket.id && room.players.size > 0) {
      const nextHostId = room.players.keys().next().value;
      room.hostId = nextHostId;
      const nextHost = room.players.get(nextHostId);
      if (nextHost) nextHost.isHost = true;
      io.to(currentRoomCode).emit('host_changed', { newHostId: nextHostId });
    }

    // Clean up empty room
    if (room.players.size === 0) {
      rooms.delete(currentRoomCode);
    }

    currentRoomCode = null;
    io.emit('rooms_list', getPublicRooms());
  };

  socket.on('leave_room', handleLeaveRoom);
  socket.on('disconnect', handleLeaveRoom);
});

server.listen(PORT, () => {
  console.log(`[Multiplayer] Socket.io server running on http://localhost:${PORT}`);
});
