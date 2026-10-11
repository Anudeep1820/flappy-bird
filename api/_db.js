/**
 * Persistent Cloud Database Adapter via GitHub API (data-store branch)
 * Provides permanent, cross-device persistence with sub-second writes and in-memory TTL caching.
 */

const REPO_OWNER = 'Anudeep1820';
const REPO_NAME = 'flappy-bird';
const DB_BRANCH = 'data-store';
const DB_FILE = 'db.json';

// In-memory cache to minimize GitHub API calls on frequent reads
let cache = {
  data: null,
  sha: null,
  timestamp: 0
};
const CACHE_TTL_MS = 2000; // 2 seconds TTL

async function getGitHubToken() {
  return process.env.GITHUB_TOKEN || null;
}

// Low-level GitHub Contents API reader
async function fetchDbFromGitHub(token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DB_FILE}?ref=${DB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub API read error: ${res.status} ${res.statusText}`);
  }

  const fileData = await res.json();
  const rawJson = Buffer.from(fileData.content, 'base64').toString('utf8');
  const parsed = JSON.parse(rawJson);

  cache = {
    data: parsed,
    sha: fileData.sha,
    timestamp: Date.now()
  };

  return { db: parsed, sha: fileData.sha };
}

// Low-level GitHub Contents API writer with automatic conflict retry
async function writeDbToGitHub(token, newDb, sha, retryCount = 0) {
  const contentBase64 = Buffer.from(JSON.stringify(newDb, null, 2)).toString('base64');
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DB_FILE}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: 'telemetry: sync persistent player records',
      content: contentBase64,
      sha: sha,
      branch: DB_BRANCH
    })
  });

  if (res.status === 409 && retryCount < 3) {
    // SHA conflict: fetch latest SHA and retry
    const latest = await fetchDbFromGitHub(token);
    return writeDbToGitHub(token, newDb, latest.sha, retryCount + 1);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API write error: ${res.status} ${errText}`);
  }

  const result = await res.json();
  cache = {
    data: newDb,
    sha: result.content ? result.content.sha : sha,
    timestamp: Date.now()
  };

  return true;
}

// Get the full database with memory cache
export async function getDatabase() {
  const token = await getGitHubToken();
  const now = Date.now();

  // Return fresh cache if available
  if (cache.data && (now - cache.timestamp < CACHE_TTL_MS)) {
    return { db: cache.data, sha: cache.sha };
  }

  if (token) {
    try {
      return await fetchDbFromGitHub(token);
    } catch {
      if (cache.data) return { db: cache.data, sha: cache.sha };
    }
  }

  // Fallback defaults
  if (!cache.data) {
    cache.data = {
      scores: [
        { id: 'sample-1', name: 'AceFlapper', score: 42, medal: 'gold', date: new Date().toISOString() },
        { id: 'sample-2', name: 'SkyDiver', score: 28, medal: 'silver', date: new Date().toISOString() },
        { id: 'sample-3', name: 'I AM NOIB', score: 21, medal: 'silver', date: new Date().toISOString() },
        { id: 'sample-4', name: 'PixelPilot', score: 15, medal: 'bronze', date: new Date().toISOString() }
      ],
      sessions: []
    };
  }

  return { db: cache.data, sha: cache.sha };
}

export async function getScores() {
  const { db } = await getDatabase();
  const scores = db.scores || [];
  return [...scores].sort((a, b) => b.score - a.score);
}

export async function addScore(entry) {
  const token = await getGitHubToken();
  const { db, sha } = await getDatabase();

  const cleanEntry = {
    id: entry.id || `score_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: (entry.name || 'Anonymous').trim().substring(0, 15),
    score: parseInt(entry.score, 10) || 0,
    medal: entry.medal || 'none',
    sessionId: entry.sessionId || null,
    date: new Date().toISOString()
  };

  if (!db.scores) db.scores = [];
  db.scores.push(cleanEntry);
  db.scores.sort((a, b) => b.score - a.score);

  // Keep top 100 scores
  db.scores = db.scores.slice(0, 100);

  // Update in-memory cache immediately
  cache.data = db;
  cache.timestamp = Date.now();

  if (token && sha) {
    try {
      await writeDbToGitHub(token, db, sha);
    } catch (err) {
      console.error('Async write error to GitHub:', err);
    }
  }

  return cleanEntry;
}

export async function deleteScore(scoreId) {
  const token = await getGitHubToken();
  const { db, sha } = await getDatabase();

  if (!db.scores) return true;
  db.scores = db.scores.filter(s => s.id !== scoreId);

  cache.data = db;
  cache.timestamp = Date.now();

  if (token && sha) {
    try {
      await writeDbToGitHub(token, db, sha);
    } catch (err) {
      console.error('Failed to persist score deletion:', err);
    }
  }

  return true;
}

export async function getSessions() {
  const { db } = await getDatabase();
  const sessions = db.sessions || [];
  return [...sessions].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

export async function recordSession(payload) {
  const token = await getGitHubToken();
  const { db, sha } = await getDatabase();

  if (!db.sessions) db.sessions = [];
  const now = new Date().toISOString();
  const existingIdx = db.sessions.findIndex(s => s.sessionId === payload.sessionId);

  if (existingIdx !== -1) {
    const s = db.sessions[existingIdx];
    s.lastSeen = now;
    if (payload.playerName && payload.playerName !== 'Guest') s.playerName = payload.playerName;
    if (payload.gamesPlayed) s.gamesPlayed = (s.gamesPlayed || 0) + payload.gamesPlayed;
    if (payload.highestScore && payload.highestScore > (s.highestScore || 0)) {
      s.highestScore = payload.highestScore;
    }
    if (payload.device) s.device = payload.device;
    if (payload.isMobile !== undefined) s.isMobile = payload.isMobile;
    db.sessions[existingIdx] = s;
  } else {
    db.sessions.unshift({
      sessionId: payload.sessionId,
      playerName: payload.playerName || 'Guest',
      device: payload.device || 'Web Device',
      browser: payload.browser || 'Browser',
      resolution: payload.resolution || 'Unknown',
      isMobile: !!payload.isMobile,
      firstSeen: now,
      lastSeen: now,
      gamesPlayed: payload.gamesPlayed || 1,
      highestScore: payload.highestScore || 0
    });
  }

  // Keep up to 200 sessions
  db.sessions = db.sessions.slice(0, 200);

  cache.data = db;
  cache.timestamp = Date.now();

  if (token && sha) {
    try {
      await writeDbToGitHub(token, db, sha);
    } catch (err) {
      console.error('Async write session error:', err);
    }
  }

  return true;
}
