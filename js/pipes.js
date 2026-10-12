/**
 * Pipes manager handling scrolling, procedural generation,
 * pacing calibration, and collision detection.
 */

export class PipeManager {
  constructor(canvasWidth, canvasHeight, groundHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundHeight = groundHeight;

    this.pipeWidth = 58;
    this.pipeGap = 132;
    this.baseSpeed = 2.4;
    this.baseSpawnInterval = 100; // frames at 60fps
    this.prng = null;
    this.onSpawnPair = null;

    this.reset();
  }

  setPrng(prngFunc) {
    this.prng = prngFunc;
  }

  setOnSpawnPair(callback) {
    this.onSpawnPair = callback;
  }

  reset() {
    this.pipes = [];
    this.spawnTimer = 0;
  }

  update(dt, flags, bird, onScore) {
    const speedMultiplier = (flags && flags.superSpeed) ? 2.5 : 1.0;
    const currentSpeed = this.baseSpeed * speedMultiplier;
    const currentSpawnInterval = this.baseSpawnInterval / speedMultiplier;

    this.spawnTimer++;
    if (this.spawnTimer >= currentSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnPipePair(flags);
    }

    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const p = this.pipes[i];
      p.x -= currentSpeed;

      if (!p.passed && p.x + this.pipeWidth < bird.x) {
        p.passed = true;
        if (onScore) onScore();
      }

      if (p.x + this.pipeWidth < -20) {
        this.pipes.splice(i, 1);
      }
    }
  }

  spawnPipePair(flags) {
    const playableHeight = this.canvasHeight - this.groundHeight;
    let gapCenter;

    if (flags && flags.flatMap) {
      // Centered elevation lock
      gapCenter = playableHeight / 2;
    } else {
      const minCenter = 60 + this.pipeGap / 2;
      const maxCenter = playableHeight - 60 - this.pipeGap / 2;
      const rand = this.prng ? this.prng() : Math.random();
      gapCenter = minCenter + rand * (maxCenter - minCenter);
    }

    const topHeight = gapCenter - this.pipeGap / 2;
    const bottomY = gapCenter + this.pipeGap / 2;
    const bottomHeight = playableHeight - bottomY;

    const pipeX = this.canvasWidth + 10;
    this.pipes.push({
      x: pipeX,
      width: this.pipeWidth,
      topHeight: topHeight,
      bottomY: bottomY,
      bottomHeight: bottomHeight,
      passed: false
    });

    // Notify coin spawner for centered coin placement
    if (this.onSpawnPair) {
      this.onSpawnPair(pipeX + this.pipeWidth / 2, gapCenter, this.pipeWidth);
    }
  }

  checkCollision(bird, flags, powers) {
    const playableHeight = this.canvasHeight - this.groundHeight;
    const bounds = bird.getBounds();

    // Invulnerability check (Ghost Mode or Active Shield Superpower)
    const hasShield = powers && powers.isShieldActive && powers.isShieldActive();
    if ((flags && flags.ghostMode) || hasShield) {
      return false;
    }

    // Ground collision
    if (bounds.y + bounds.height >= playableHeight) {
      return true;
    }

    // Ceiling collision
    if (bounds.y <= 0) {
      return true;
    }

    // Obstacle collision
    for (const p of this.pipes) {
      if (bounds.x + bounds.width > p.x && bounds.x < p.x + p.width) {
        if (bounds.y < p.topHeight) {
          return true;
        }
        if (bounds.y + bounds.height > p.bottomY) {
          return true;
        }
      }
    }

    return false;
  }

  draw(ctx) {
    const collarHeight = 24;
    const collarOverhang = 3;

    for (const p of this.pipes) {
      ctx.save();

      // Top Pipe Body
      this.drawPipeSegment(ctx, p.x, 0, p.width, p.topHeight - collarHeight);
      // Top Pipe Cap Collar
      this.drawPipeCollar(ctx, p.x - collarOverhang, p.topHeight - collarHeight, p.width + collarOverhang * 2, collarHeight);

      // Bottom Pipe Cap Collar
      this.drawPipeCollar(ctx, p.x - collarOverhang, p.bottomY, p.width + collarOverhang * 2, collarHeight);
      // Bottom Pipe Body
      this.drawPipeSegment(ctx, p.x, p.bottomY + collarHeight, p.width, p.bottomHeight - collarHeight);

      ctx.restore();
    }
  }

  drawPipeSegment(ctx, x, y, width, height) {
    if (height <= 0) return;

    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(x, y, width, height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#543847';
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#8be238';
    ctx.fillRect(x + 4, y, 6, height);

    ctx.fillStyle = '#558b20';
    ctx.fillRect(x + width - 10, y, 8, height);
  }

  drawPipeCollar(ctx, x, y, width, height) {
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(x, y, width, height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#543847';
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#8be238';
    ctx.fillRect(x + 5, y, 7, height);

    ctx.fillStyle = '#558b20';
    ctx.fillRect(x + width - 12, y, 9, height);
  }
}
