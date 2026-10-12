/**
 * Serverless API endpoint for Public Multiplayer Rooms discovery on Vercel.
 */

// In-memory rooms cache with TTL
const publicRooms = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

function cleanExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of publicRooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      publicRooms.delete(code);
    }
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  cleanExpiredRooms();

  if (req.method === 'GET') {
    const list = [];
    for (const [code, r] of publicRooms.entries()) {
      list.push({
        code,
        hostName: r.hostName || 'Host',
        playerCount: r.playerCount || 1,
        state: r.state || 'WAITING'
      });
    }
    return res.status(200).json(list);
  }

  if (req.method === 'POST') {
    const { action, code, hostName, playerCount, state } = req.body || {};
    const roomCode = (code || '').toUpperCase().trim();

    if (!roomCode) {
      return res.status(400).json({ error: 'Room code required' });
    }

    if (action === 'unregister') {
      publicRooms.delete(roomCode);
      return res.status(200).json({ success: true });
    }

    // Register or heartbeat room
    publicRooms.set(roomCode, {
      code: roomCode,
      hostName: hostName || 'Host',
      playerCount: playerCount || 1,
      state: state || 'WAITING',
      updatedAt: Date.now()
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
