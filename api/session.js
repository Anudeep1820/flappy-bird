import { recordSession } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      if (!payload.sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      await recordSession(payload);
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to record session telemetry' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
