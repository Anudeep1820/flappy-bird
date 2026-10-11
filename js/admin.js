/**
 * Admin Portal Dashboard Client
 * Handles authentication, real-time analytics visualization, and leaderboard moderation.
 */

class AdminPortal {
  constructor() {
    this.token = sessionStorage.getItem('flappy_admin_token');

    // DOM Elements
    this.loginView = document.getElementById('login-view');
    this.dashboardView = document.getElementById('dashboard-view');
    this.loginForm = document.getElementById('admin-login-form');
    this.passcodeInput = document.getElementById('passcode-input');
    this.loginError = document.getElementById('login-error');
    this.logoutBtn = document.getElementById('logout-btn');
    this.refreshBtn = document.getElementById('refresh-data-btn');

    // Stat Cards
    this.statPlayers = document.getElementById('stat-players');
    this.statGames = document.getElementById('stat-games');
    this.statHighScore = document.getElementById('stat-high-score');
    this.statMobile = document.getElementById('stat-mobile');

    // Table Bodies
    this.sessionsBody = document.getElementById('sessions-table-body');
    this.scoresBody = document.getElementById('scores-table-body');
    this.sessionsBadge = document.getElementById('sessions-count-badge');
    this.scoresBadge = document.getElementById('scores-count-badge');

    this.init();
  }

  init() {
    this.initEvents();

    if (this.token) {
      this.showDashboard();
      this.fetchDashboardData();
    } else {
      this.showLogin();
    }
  }

  initEvents() {
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.fetchDashboardData();
      });
    }
  }

  showLogin() {
    this.loginView.style.display = 'block';
    this.dashboardView.style.display = 'none';
    this.logoutBtn.style.display = 'none';
    if (this.loginError) this.loginError.style.display = 'none';
  }

  showDashboard() {
    this.loginView.style.display = 'none';
    this.dashboardView.style.display = 'block';
    this.logoutBtn.style.display = 'inline-block';
  }

  async handleLogin() {
    const passcode = this.passcodeInput.value.trim();
    if (!passcode) return;

    if (this.loginError) this.loginError.style.display = 'none';

    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      const data = await res.json();
      if (res.ok && data.token) {
        this.token = data.token;
        sessionStorage.setItem('flappy_admin_token', this.token);
        this.showDashboard();
        this.fetchDashboardData();
      } else {
        if (this.loginError) {
          this.loginError.textContent = data.error || 'Invalid passcode. Please try again.';
          this.loginError.style.display = 'block';
        }
      }
    } catch {
      if (this.loginError) {
        this.loginError.textContent = 'Server connection error. Please try again.';
        this.loginError.style.display = 'block';
      }
    }
  }

  logout() {
    this.token = null;
    sessionStorage.removeItem('flappy_admin_token');
    this.showLogin();
  }

  async fetchDashboardData() {
    if (!this.token) return;

    try {
      const res = await fetch('/api/admin?action=data', {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Failed to load dashboard data');

      const data = await res.json();
      this.renderStats(data.stats);
      this.renderSessions(data.sessions || []);
      this.renderScores(data.scores || []);
    } catch (err) {
      console.error(err);
    }
  }

  renderStats(stats) {
    if (!stats) return;
    if (this.statPlayers) this.statPlayers.textContent = stats.totalPlayers || 0;
    if (this.statGames) this.statGames.textContent = stats.totalGames || 0;
    if (this.statHighScore) this.statHighScore.textContent = stats.highestScore || 0;
    if (this.statMobile) this.statMobile.textContent = `${stats.mobilePercentage || 0}%`;
  }

  renderSessions(sessions) {
    if (!this.sessionsBody) return;
    if (this.sessionsBadge) this.sessionsBadge.textContent = `${sessions.length} records`;

    if (sessions.length === 0) {
      this.sessionsBody.innerHTML = `
        <tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">No player session activity recorded yet.</td></tr>
      `;
      return;
    }

    this.sessionsBody.innerHTML = sessions.map(s => {
      const timeAgo = this.formatRelativeTime(s.lastSeen);
      const isRecent = (Date.now() - new Date(s.lastSeen).getTime()) < 300000; // < 5 mins
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #f1f5f9;">
              ${this.escapeHtml(s.playerName || 'Guest')}
              ${isRecent ? '<span style="color: #4ade80; font-size: 10px; margin-left: 4px;">● active</span>' : ''}
            </div>
            <div style="font-size: 10px; color: #64748b; font-family: monospace;">${this.escapeHtml(s.sessionId || '')}</div>
          </td>
          <td><span class="badge-device">${this.escapeHtml(s.device || 'Unknown')}</span></td>
          <td>${this.escapeHtml(s.browser || 'Unknown')}</td>
          <td style="font-weight: 600;">${s.gamesPlayed || 1}</td>
          <td style="color: #facc15; font-weight: 700;">${s.highestScore || 0}</td>
          <td style="color: #94a3b8; font-size: 12px;">${timeAgo}</td>
        </tr>
      `;
    }).join('');
  }

  renderScores(scores) {
    if (!this.scoresBody) return;
    if (this.scoresBadge) this.scoresBadge.textContent = `${scores.length} entries`;

    if (scores.length === 0) {
      this.scoresBody.innerHTML = `
        <tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">No leaderboard scores submitted yet.</td></tr>
      `;
      return;
    }

    this.scoresBody.innerHTML = scores.map((s, idx) => {
      const rank = idx + 1;
      let medalBadge = '';
      if (s.medal && s.medal !== 'none') {
        medalBadge = `<span style="text-transform: capitalize; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #fbbf24;">${s.medal}</span>`;
      }

      return `
        <tr>
          <td style="font-weight: 700; color: ${rank === 1 ? '#fbbf24' : (rank === 2 ? '#cbd5e1' : (rank === 3 ? '#cd7f32' : '#94a3b8'))};">
            #${rank}
          </td>
          <td style="font-weight: 600; color: #f8fafc;">${this.escapeHtml(s.name || 'Anonymous')}</td>
          <td style="color: #38bdf8; font-family: 'Press Start 2P', monospace; font-size: 12px;">${s.score}</td>
          <td>${medalBadge}</td>
          <td style="color: #94a3b8; font-size: 12px;">${this.formatDate(s.date)}</td>
          <td>
            <button class="delete-btn" data-id="${s.id}">
              <i class="fa fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach delete listeners
    this.scoresBody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scoreId = e.currentTarget.getAttribute('data-id');
        this.handleDeleteScore(scoreId);
      });
    });
  }

  async handleDeleteScore(scoreId) {
    if (!confirm('Are you sure you want to remove this score entry from the public leaderboard?')) {
      return;
    }

    try {
      const res = await fetch('/api/admin?action=delete-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({ scoreId })
      });

      if (res.ok) {
        this.fetchDashboardData();
      } else {
        alert('Failed to delete score entry.');
      }
    } catch {
      alert('Network error while deleting entry.');
    }
  }

  formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
