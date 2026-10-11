/**
 * Leaderboard & Session Telemetry Client Module
 * Handles public scoreboard fetching, score submission, and anonymous session telemetry.
 */

class LeaderboardClient {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.playerName = localStorage.getItem('flappy_player_name') || '';
    this.sessionGames = 0;
    this.sessionHighestScore = 0;

    this.initSession();
  }

  getOrCreateSessionId() {
    let id = localStorage.getItem('flappy_session_id');
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('flappy_session_id', id);
    }
    return id;
  }

  detectDevice() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'Apple iOS';
    if (/Android/.test(ua)) return 'Android Mobile';
    if (/Macintosh|Mac OS X/.test(ua)) return 'macOS Desktop';
    if (/Windows NT/.test(ua)) return 'Windows PC';
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return 'Web Device';
  }

  detectBrowser() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    return 'Browser';
  }

  async initSession() {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          playerName: this.playerName,
          device: this.detectDevice(),
          browser: this.detectBrowser(),
          resolution: `${window.innerWidth}x${window.innerHeight}`
        })
      });
    } catch {
      // Offline / failsafe
    }
  }

  async logGamePlayed(score) {
    this.sessionGames++;
    if (score > this.sessionHighestScore) {
      this.sessionHighestScore = score;
    }

    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          gamesPlayed: 1,
          highestScore: this.sessionHighestScore,
          playerName: this.playerName
        })
      });
    } catch {
      // Offline / failsafe
    }
  }

  async fetchScores() {
    try {
      const res = await fetch('/api/scores');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      return data.scores || [];
    } catch {
      // Fallback local highscore if server is unreachable
      const local = parseInt(localStorage.getItem('flappy_highscore') || '0', 10);
      return [
        { id: 'local-1', name: this.playerName || 'You (Local)', score: local, medal: 'gold', date: new Date().toISOString() }
      ];
    }
  }

  async submitScore(name, score, medal) {
    const cleanName = (name || 'Player').trim().substring(0, 15);
    this.playerName = cleanName;
    localStorage.setItem('flappy_player_name', cleanName);

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          score,
          medal,
          sessionId: this.sessionId
        })
      });

      if (!res.ok) throw new Error('Failed to submit');
      const data = await res.json();
      return data.entry;
    } catch {
      return null;
    }
  }
}

export const leaderboardClient = new LeaderboardClient();
