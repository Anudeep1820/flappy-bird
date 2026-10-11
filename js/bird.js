/**
 * Bird entity handling physics, rotation, flap animation, and visual states.
 */

export class Bird {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.width = 34;
    this.height = 24;

    this.reset();
  }

  reset() {
    this.x = 75;
    this.y = this.canvasHeight / 2 - 40;
    this.velocity = 0;
    this.gravity = 0.28;
    this.jumpForce = -6.2;
    this.maxVelocity = 8.5;
    this.rotation = 0;

    // Wing flap animation cycle
    this.animTick = 0;
    this.wingPhase = 0; // 0: down, 1: mid, 2: up
    this.isDead = false;
  }

  flap() {
    if (this.isDead) return;
    this.velocity = this.jumpForce;
    this.rotation = -0.45;
  }

  update(dt, flags) {
    this.velocity += this.gravity;
    if (this.velocity > this.maxVelocity) {
      this.velocity = this.maxVelocity;
    }

    this.y += this.velocity;

    // Boundary guard
    if (flags && flags.ghostMode && this.y > this.canvasHeight + 15) {
      this.y = this.canvasHeight + 15;
      this.velocity = 0;
    }

    // Smooth rotational tilt
    if (this.velocity < 0) {
      this.rotation = Math.max(-0.48, this.velocity * 0.08);
    } else {
      this.rotation = Math.min(Math.PI / 2.2, this.rotation + 0.045);
    }

    // Advance wing animation
    this.animTick++;
    if (this.animTick % 5 === 0) {
      this.wingPhase = (this.wingPhase + 1) % 4;
    }
  }

  getBounds() {
    const insetX = 4;
    const insetY = 4;
    return {
      x: this.x - this.width / 2 + insetX,
      y: this.y - this.height / 2 + insetY,
      width: this.width - insetX * 2,
      height: this.height - insetY * 2,
      centerX: this.x,
      centerY: this.y,
      radius: (this.width / 2) - 3
    };
  }

  draw(ctx, flags) {
    ctx.save();

    // Visual pass-through state: translucent cyan glow
    if (flags && flags.ghostMode) {
      ctx.globalAlpha = 0.45;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 14;
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (flags && flags.ghostMode) {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width / 2 + 5, this.height / 2 + 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 1. Main Body
    ctx.fillStyle = '#ffcf10';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#543847';
    ctx.stroke();

    // 2. Belly Accent
    ctx.fillStyle = '#fff4a3';
    ctx.beginPath();
    ctx.ellipse(-2, 3, this.width / 3, this.height / 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Eye
    const eyeX = 6;
    const eyeY = -4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eyeX + 2, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye catch-light
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 4. Beak (Orange)
    ctx.fillStyle = '#f85800';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(17, 3);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Beak split line
    ctx.beginPath();
    ctx.moveTo(9, 3.5);
    ctx.lineTo(16, 3.5);
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 5. Wing (Animated flap)
    let wingOffsetY = 0;
    let wingTilt = 0;

    if (this.wingPhase === 0) {
      wingOffsetY = 3;
      wingTilt = 0.2;
    } else if (this.wingPhase === 1 || this.wingPhase === 3) {
      wingOffsetY = 0;
      wingTilt = 0;
    } else if (this.wingPhase === 2) {
      wingOffsetY = -4;
      wingTilt = -0.3;
    }

    ctx.save();
    ctx.translate(-7, 1 + wingOffsetY);
    ctx.rotate(wingTilt);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
