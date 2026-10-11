/**
 * Unified Database Storage Layer for Vercel Serverless
 * Supports Upstash Redis REST, Supabase, and resilient serverless memory caching.
 */

// In-memory fallback cache across warm invocations
const memoryStore = {
  scores: [
    { id: 'sample-1', name: 'AceFlapper', score: 42, medal: 'gold', date: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 'sample-2', name: 'SkyDiver', score: 28, medal: 'silver', date: new Date(Date.now() - 3600000 * 5).toISOString() },
    { id: 'sample-3', name: 'PixelPilot', score: 15, medal: 'bronze', date: new Date(Date.now() - 3600000 * 12).toISOString() }
  ],
  sessions: []
};

// 1. Upstash Redis Provider
async function upstashCommand(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

// --- High-level Database Operations ---

export async function getScores() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const data = await upstashCommand('GET', 'flappy_scores');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed.sort((a, b) => b.score - a.score);
      } catch {
        // Fall through
      }
    }
  }

  return [...memoryStore.scores].sort((a, b) => b.score - a.score);
}

export async function addScore(entry) {
  const scores = await getScores();
  
  // Clean sanitization
  const cleanEntry = {
    id: entry.id || `score_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: (entry.name || 'Anonymous').trim().substring(0, 15),
    score: parseInt(entry.score, 10) || 0,
    medal: entry.medal || 'none',
    sessionId: entry.sessionId || null,
    date: new Date().toISOString()
  };

  scores.push(cleanEntry);
  scores.sort((a, b) => b.score - a.score);

  // Keep top 100 leaderboard entries
  const trimmed = scores.slice(0, 100);

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    await upstashCommand('SET', 'flappy_scores', JSON.stringify(trimmed));
  } else {
    memoryStore.scores = trimmed;
  }

  return cleanEntry;
}

export async function deleteScore(scoreId) {
  let scores = await getScores();
  scores = scores.filter(s => s.id !== scoreId);

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    await upstashCommand('SET', 'flappy_scores', JSON.stringify(scores));
  } else {
    memoryStore.scores = scores;
  }

  return true;
}

export async function getSessions() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const data = await upstashCommand('GET', 'flappy_sessions');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
      } catch {
        // Fall through
      }
    }
  }

  return [...memoryStore.sessions].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

export async function recordSession(payload) {
  const sessions = await getSessions();
  const now = new Date().toISOString();
  const existingIdx = sessions.findIndex(s => s.sessionId === payload.sessionId);

  if (existingIdx !== -1) {
    const s = sessions[existingIdx];
    s.lastSeen = now;
    if (payload.playerName) s.playerName = payload.playerName;
    if (payload.gamesPlayed) s.gamesPlayed = (s.gamesPlayed || 0) + payload.gamesPlayed;
    if (payload.highestScore && payload.highestScore > (s.highestScore || 0)) {
      s.highestScore = payload.highestScore;
    }
    sessions[existingIdx] = s;
  } else {
    sessions.unshift({
      sessionId: payload.sessionId,
      playerName: payload.playerName || 'Guest',
      device: payload.device || 'Unknown',
      browser: payload.browser || 'Unknown',
      resolution: payload.resolution || 'Unknown',
      firstSeen: now,
      lastSeen: now,
      gamesPlayed: payload.gamesPlayed || 1,
      highestScore: payload.highestScore || 0
    });
  }

  // Keep most recent 200 sessions
  const trimmed = sessions.slice(0, 200);

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    await upstashCommand('SET', 'flappy_sessions', JSON.stringify(trimmed));
  } else {
    memoryStore.sessions = trimmed;
  }

  return true;
}
