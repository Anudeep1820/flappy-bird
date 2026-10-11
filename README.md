# Flappy Bird Arcade 🐤

A classic retro arcade Flappy Bird game built with modern web technologies: HTML5 Canvas, modular JavaScript (ES Modules), procedural audio synthesis via the Web Audio API, and a live global scoreboard with an admin telemetry portal.

![Flappy Bird](https://img.shields.io/badge/HTML5-Canvas-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)
![Audio](https://img.shields.io/badge/Audio-Web_Audio_API-blue)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)

---

## 🎮 Features

- **Smooth 60 FPS Physics**: Authentic gravitational acceleration, impulse jump arcs, and terminal velocity.
- **Global Scoreboard**: Real-time player rankings with name submission and medal achievements.
- **Admin Control Portal (`/admin.html`)**: Passcode-protected administrator console with player session logs, device analytics, and leaderboard moderation.
- **Dynamic Procedural Audio**: Flap swooshes, score chimes, and collision sound effects generated via the Web Audio API.
- **Retro Parallax Visuals**: Multi-layered background with scrolling clouds, skyline silhouettes, and patterned terrain.
- **Responsive & Cross-Platform**: Optimized for mobile smartphones (`100dvh`, notch safe-areas), tablets, and desktop displays.

---

## 🕹️ Controls

| Action | Desktop Keyboard | Mouse / Touchscreen |
| :--- | :--- | :--- |
| **Flap / Jump** | `Space`, `Arrow Up`, or `W` | Tap / Click Screen |
| **Restart** | `Enter` or `Space` | Tap anywhere on Game Over |
| **View Rankings** | Click Rankings button | Tap Rankings button |

---

## 🔐 Admin Portal

Access the administrator console at `/admin.html`:
- **Default Passcode**: `admin1820` (customizable via `ADMIN_PASSCODE` environment variable).
- **Features**:
  - Live session telemetry: see who played, what devices/browsers they used, and their high scores.
  - Overall metrics: total players, total games played, global high score, mobile traffic %.
  - Scoreboard moderation: delete entries with one click.

---

## 🚀 Getting Started Locally

Serve the repository with any local HTTP server:

```bash
python3 -m http.server 8000
```
Then visit [http://localhost:8000](http://localhost:8000) in your browser.

---

## 📁 Project Architecture

```
flappy-bird/
├── index.html        # Game canvas, HUD overlays, and scoreboard modal
├── admin.html        # Dedicated Admin Portal dashboard
├── style.css         # Retro arcade layout, responsive styles, and modal UI
├── package.json      # Node.js project manifest (ES Modules)
├── api/              # Vercel Serverless Functions
│   ├── _db.js        # Universal database adapter (Upstash Redis + fallback)
│   ├── scores.js     # Leaderboard retrieval and submission API
│   ├── session.js    # Player telemetry API
│   └── admin.js      # Admin authentication and analytics API
└── js/
    ├── main.js       # Core game loop and state coordinator
    ├── bird.js       # Player entity physics and animations
    ├── pipes.js      # Procedural pipe obstacle pool and collisions
    ├── audio.js      # Procedural Web Audio API sound synthesis
    ├── leaderboard.js # Client leaderboard and session telemetry
    ├── admin.js      # Admin portal UI and data management
    └── diagnostics.js # Engine performance & calibration module
```

---

## 📜 License

MIT License. Free to use, modify, and distribute.
