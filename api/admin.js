import crypto from 'crypto';
import { getScores, deleteScore, getSessions } from './_db.js';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin1820';

function getAdminToken() {
  return crypto.createHash('sha256').update(`flappy_admin_${ADMIN_PASSCODE}`).digest('hex');
}

function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === getAdminToken();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query || {};

  // 1. Admin Login
  if (action === 'login' && req.method === 'POST') {
    const { passcode } = req.body || {};
    if (passcode === ADMIN_PASSCODE) {
      return res.status(200).json({
        success: true,
        token: getAdminToken()
      });
    }
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }

  // Auth gate for protected actions
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
  }

  // 2. Fetch Admin Dashboard Data
  if (action === 'data' && req.method === 'GET') {
    try {
      const scores = await getScores();
      const sessions = await getSessions();

      // Compute analytics
      const totalPlayers = sessions.length;
      const totalGames = sessions.reduce((acc, s) => acc + (s.gamesPlayed || 1), 0);
      const highestScore = scores.length > 0 ? scores[0].score : 0;

      const mobileCount = sessions.filter(s =>
        (s.device || '').toLowerCase().includes('iphone') ||
        (s.device || '').toLowerCase().includes('android') ||
        (s.device || '').toLowerCase().includes('mobile')
      ).length;
      const mobilePercentage = totalPlayers > 0 ? Math.round((mobileCount / totalPlayers) * 100) : 0;

      return res.status(200).json({
        stats: {
          totalPlayers,
          totalGames,
          highestScore,
          mobilePercentage
        },
        sessions,
        scores
      });
    } catch {
      return res.status(500).json({ error: 'Failed to retrieve dashboard analytics' });
    }
  }

  // 3. Delete Score
  if (action === 'delete-score' && req.method === 'POST') {
    try {
      const { scoreId } = req.body || {};
      if (!scoreId) {
        return res.status(400).json({ error: 'scoreId is required' });
      }
      await deleteScore(scoreId);
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to delete score entry' });
    }
  }

  return res.status(404).json({ error: 'Action not found' });
}
