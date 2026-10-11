/**
 * Leaderboard & Session Telemetry Client Module
 * Handles public scoreboard fetching, score submission, and anonymous session telemetry.
 */

class LeaderboardClient {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.playerName = localStorage.getItem('flappy_player_name') || '';
    this.sessionGames = 0;
    this.sessionHighestScore = parseInt(localStorage.getItem('flappy_highscore') || '0', 10);

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

  isMobileDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      return navigator.userAgentData.mobile;
    }
    const ua = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return true;
    }
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 820;
  }

  detectDevice() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iPhone / iOS';
    if (/Android/.test(ua)) return 'Android Mobile';
    if (/Macintosh|Mac OS X/.test(ua)) return 'Mac Desktop';
    if (/Windows NT/.test(ua)) return 'Windows PC';
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return this.isMobileDevice() ? 'Mobile Device' : 'Desktop PC';
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
          playerName: this.playerName || 'Guest',
          device: this.detectDevice(),
          browser: this.detectBrowser(),
          resolution: `${window.innerWidth}x${window.innerHeight}`,
          isMobile: this.isMobileDevice(),
          highestScore: this.sessionHighestScore
        })
      });
    } catch {
      // Offline failsafe
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
          playerName: this.playerName || 'Guest',
          device: this.detectDevice(),
          isMobile: this.isMobileDevice()
        })
      });
    } catch {
      // Offline failsafe
    }
  }

  async fetchScores() {
    try {
      const res = await fetch('/api/scores?t=' + Date.now());
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      return data.scores || [];
    } catch {
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

      // Also update session name
      this.initSession();

      return data.entry;
    } catch {
      return null;
    }
  }
}

export const leaderboardClient = new LeaderboardClient();
