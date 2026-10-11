import { getScores, addScore } from './_db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const scores = await getScores();
      return res.status(200).json({ scores });
    } catch {
      return res.status(500).json({ error: 'Failed to retrieve scores' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, score, medal, sessionId } = req.body || {};

      if (score === undefined || score === null) {
        return res.status(400).json({ error: 'Score is required' });
      }

      const entry = await addScore({
        name: name || 'Player',
        score: parseInt(score, 10),
        medal: medal || 'none',
        sessionId: sessionId || null
      });

      return res.status(201).json({ success: true, entry });
    } catch {
      return res.status(500).json({ error: 'Failed to record score' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
