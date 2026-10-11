# Flappy Bird Arcade 🐤

A classic retro arcade Flappy Bird game built with modern web technologies: HTML5 Canvas, modular JavaScript (ES Modules), and procedural audio synthesis via the Web Audio API.

![Flappy Bird](https://img.shields.io/badge/HTML5-Canvas-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)
![Audio](https://img.shields.io/badge/Audio-Web_Audio_API-blue)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

---

## 🎮 Features

- **Smooth 60 FPS Physics**: Authentic gravitational acceleration, impulse jump arcs, and terminal velocity.
- **Dynamic Procedural Audio**: Flap swooshes, score chimes, and collision sound effects generated via the Web Audio API without external audio files.
- **Retro Parallax Visuals**: Multi-layered background with scrolling clouds, skyline silhouettes, and patterned terrain.
- **High Score Tracking**: Local storage persistence (`localStorage`) with achievement medal tiers (Bronze, Silver, Gold, Platinum).
- **Responsive & Cross-Platform**: Full support for desktop keyboard controls, mouse clicks, and mobile touch events.
- **Zero External Dependencies**: 100% self-contained vanilla web application.

---

## 🕹️ Controls

| Action | Desktop Keyboard | Mouse / Touchscreen |
| :--- | :--- | :--- |
| **Flap / Jump** | `Space` or `Arrow Up` | Tap / Click Screen |
| **Restart** | `Enter` or `Space` | Tap Play Again Button |

---

## 🚀 Getting Started

No build step or external dependencies are required. Simply serve the repository with any local HTTP server:

### Using Python
```bash
python3 -m http.server 8000
```
Then visit [http://localhost:8000](http://localhost:8000) in your browser.

### Using Node.js
```bash
npx serve .
```

---

## 📁 Project Architecture

```
flappy-bird/
├── index.html        # Viewport canvas and HUD overlays
├── style.css         # Retro arcade layout and responsive styling
└── js/
    ├── main.js       # Core game loop and state coordinator
    ├── bird.js       # Player entity physics and animations
    ├── pipes.js      # Procedural pipe obstacle pool and collisions
    ├── audio.js      # Procedural Web Audio API sound synthesis
    └── diagnostics.js # Engine performance & calibration module
```

---

## 📜 License

MIT License. Free to use, modify, and distribute.
