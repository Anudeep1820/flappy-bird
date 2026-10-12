/**
 * Coins System for Flappy Bird
 * Deterministic coin generation based on PRNG seed,
 * 3D rotating coin animation, magnetic pull physics, and sound feedback.
 */

import { sound } from './audio.js';

export function createMulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CoinManager {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.coins = [];
    this.runCoins = 0;
    this.totalCoins = parseInt(localStorage.getItem('flappy_total_coins') || '0', 10);

    // Callbacks
    this.onCoinPickup = null;
    this.spawnParticleCb = null;
  }

  reset() {
    this.coins = [];
    this.runCoins = 0;
  }

  setCallbacks({ onCoinPickup, spawnParticleCb }) {
    this.onCoinPickup = onCoinPickup;
    this.spawnParticleCb = spawnParticleCb;
  }

  /**
   * Spawn a coin in the center of a pipe gap
   */
  spawnCoinAt(x, y) {
    this.coins.push({
      x: x,
      baseY: y,
      y: y,
      radius: 8.5,
      animTick: Math.floor(Math.random() * 60),
      collected: false
    });
  }

  update(dt, bird, speed, powers) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.animTick++;

      // Scroll with map
      c.x -= speed;

      // Bobbing floating animation
      c.y = c.baseY + Math.sin(c.animTick * 0.08) * 4;

      // Coin Magnet Power Attraction
      if (powers && powers.isMagnetActive() && !bird.isDead) {
        const dx = bird.x - c.x;
        const dy = bird.y - c.y;
        const dist = Math.hypot(dx, dy);
        const magnetReach = 190;

        if (dist < magnetReach && dist > 2) {
          const pullForce = Math.min(10, (1 - dist / magnetReach) * 9 + 3.5);
          c.x += (dx / dist) * pullForce;
          c.baseY += (dy / dist) * pullForce;
          c.y += (dy / dist) * pullForce;
        }
      }

      // Check pickup collision with bird
      if (!bird.isDead) {
        const bounds = bird.getBounds();
        const birdCenterX = bounds.centerX;
        const birdCenterY = bounds.centerY;
        const hitDist = Math.hypot(birdCenterX - c.x, birdCenterY - c.y);

        if (hitDist <= bounds.radius + c.radius + 3) {
          // Collected!
          this.collectCoin(c, i);
          continue;
        }
      }

      // Despawn off left edge
      if (c.x < -30) {
        this.coins.splice(i, 1);
      }
    }
  }

  collectCoin(coin, index) {
    this.coins.splice(index, 1);
    this.runCoins++;
    this.totalCoins++;
    localStorage.setItem('flappy_total_coins', this.totalCoins.toString());

    // Play retro chime sound
    sound.playCoin();

    // Spawn gold sparkle particles
    if (this.spawnParticleCb) {
      this.spawnParticleCb(coin.x, coin.y);
    }

    if (this.onCoinPickup) {
      this.onCoinPickup(this.runCoins, this.totalCoins);
    }
  }

  draw(ctx) {
    for (const c of this.coins) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Rotating spin scale
      const spinScale = Math.sin(c.animTick * 0.12);
      ctx.scale(Math.max(0.18, Math.abs(spinScale)), 1);

      // Outer golden glow & rim
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#78350f';
      ctx.stroke();

      // Inner coin face
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, c.radius - 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Coin Star / Emblem
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0.5);

      ctx.restore();
    }
  }
}
