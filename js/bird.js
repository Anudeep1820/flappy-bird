/**
 * Bird entity handling physics, rotation, flap animation, custom skins,
 * accessories, and Ghost Mode visual states.
 */

export class Bird {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.width = 34;
    this.height = 24;

    this.skin = null;
    this.customImageObj = null;

    this.reset();
  }

  setSkin(skin) {
    this.skin = skin;
    if (skin && skin.customImage) {
      const img = new Image();
      img.src = skin.customImage;
      img.onload = () => {
        this.customImageObj = img;
      };
    } else {
      this.customImageObj = null;
    }
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

    const skin = this.skin || {};
    const bodyColor = skin.bodyColor || '#ffcf10';
    const bellyColor = skin.bellyColor || '#fff4a3';
    const wingColor = skin.wingColor || '#ffffff';
    const beakColor = skin.beakColor || '#f85800';
    const outlineColor = skin.outlineColor || '#543847';

    // Check if custom uploaded user image exists
    if (this.customImageObj && this.customImageObj.complete && this.customImageObj.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.customImageObj, -this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = outlineColor;
      ctx.stroke();
    } else {
      // 1. Main Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = outlineColor;
      ctx.stroke();

      // 2. Belly Accent
      ctx.fillStyle = bellyColor;
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
      ctx.strokeStyle = outlineColor;
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
    }

    // 4. Beak (Orange / Custom Color)
    ctx.fillStyle = beakColor;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(17, 3);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Beak split line
    ctx.beginPath();
    ctx.moveTo(9, 3.5);
    ctx.lineTo(16, 3.5);
    ctx.strokeStyle = outlineColor;
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
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // 6. Draw Equipped Accessory
    this.drawAccessory(ctx, skin.accessory);

    ctx.restore();
  }

  drawAccessory(ctx, accessory) {
    if (!accessory || accessory === 'none') return;

    if (accessory === 'sunglasses') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(4, -7, 13, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -7, 13, 6);

      // White glare line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(6, -6, 2, 2);
      ctx.fillRect(12, -6, 2, 2);
    } else if (accessory === 'crown') {
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -11);
      ctx.lineTo(-8, -19);
      ctx.lineTo(-2, -14);
      ctx.lineTo(3, -21);
      ctx.lineTo(8, -14);
      ctx.lineTo(14, -19);
      ctx.lineTo(12, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ruby jewel
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(3, -15, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'halo') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(2, -17, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (accessory === 'bow') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-4, -12, 4, 0, Math.PI * 2);
      ctx.arc(6, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe4e6';
      ctx.beginPath();
      ctx.arc(1, -12, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'cap') {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(2, -10, 12, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(6, -9, 10, 2.5);
    }
  }
}
