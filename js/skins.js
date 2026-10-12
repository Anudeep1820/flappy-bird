/**
 * Skins Manager for Flappy Bird
 * Provides preset skins locker, user custom color customizer,
 * accessory gear, and custom photo/sprite image uploads.
 */

export const PRESET_SKINS = [
  {
    id: 'classic',
    name: 'Classic Chick',
    bodyColor: '#ffcf10',
    bellyColor: '#fff4a3',
    wingColor: '#ffffff',
    beakColor: '#f85800',
    outlineColor: '#543847',
    accessory: 'none'
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    bodyColor: '#00f0ff',
    bellyColor: '#ff007f',
    wingColor: '#1e1b4b',
    beakColor: '#f43f5e',
    outlineColor: '#0284c7',
    accessory: 'sunglasses'
  },
  {
    id: 'phoenix',
    name: 'Phoenix Blaze',
    bodyColor: '#ef4444',
    bellyColor: '#fbbf24',
    wingColor: '#f97316',
    beakColor: '#b91c1c',
    outlineColor: '#7f1d1d',
    accessory: 'none'
  },
  {
    id: 'ninja',
    name: 'Midnight Ninja',
    bodyColor: '#1e293b',
    bellyColor: '#334155',
    wingColor: '#dc2626',
    beakColor: '#991b1b',
    outlineColor: '#0f172a',
    accessory: 'cap'
  },
  {
    id: 'royal',
    name: 'Golden Royale',
    bodyColor: '#ffd700',
    bellyColor: '#fef08a',
    wingColor: '#ffffff',
    beakColor: '#d97706',
    outlineColor: '#78350f',
    accessory: 'crown'
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    bodyColor: '#f472b6',
    bellyColor: '#fbcfe8',
    wingColor: '#ffffff',
    beakColor: '#db2777',
    outlineColor: '#831843',
    accessory: 'bow'
  },
  {
    id: 'angel',
    name: 'Angel Bird',
    bodyColor: '#ffffff',
    bellyColor: '#e0f2fe',
    wingColor: '#38bdf8',
    beakColor: '#f59e0b',
    outlineColor: '#0369a1',
    accessory: 'halo'
  },
  {
    id: 'toxic',
    name: 'Toxic Slime',
    bodyColor: '#22c55e',
    bellyColor: '#bef264',
    wingColor: '#a855f7',
    beakColor: '#7e22ce',
    outlineColor: '#14532d',
    accessory: 'sunglasses'
  }
];

export class SkinsManager {
  constructor({ onSkinChange, onOpen, onClose }) {
    this.onSkinChange = onSkinChange;
    this.onOpen = onOpen;
    this.onClose = onClose;

    // Load active skin
    this.activeSkinId = localStorage.getItem('flappy_active_skin_id') || 'classic';
    this.customSkin = this.loadCustomSkin();

    // DOM Elements
    this.modal = document.getElementById('skins-modal');
    this.closeBtn = document.getElementById('skins-close-btn');
    this.tabPresetsBtn = document.getElementById('tab-presets-btn');
    this.tabCustomBtn = document.getElementById('tab-custom-btn');
    this.presetsView = document.getElementById('skins-presets-view');
    this.customView = document.getElementById('skins-custom-view');
    this.presetsGrid = document.getElementById('skins-grid');

    // Custom Creator Elements
    this.previewCanvas = document.getElementById('custom-preview-canvas');
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;
    this.colorBody = document.getElementById('skin-color-body');
    this.colorBelly = document.getElementById('skin-color-belly');
    this.colorWing = document.getElementById('skin-color-wing');
    this.colorBeak = document.getElementById('skin-color-beak');
    this.accessoryChips = document.getElementById('accessory-chips');
    this.imageUpload = document.getElementById('skin-image-upload');
    this.removeImageBtn = document.getElementById('remove-image-btn');
    this.saveCustomBtn = document.getElementById('save-custom-skin-btn');

    // Live preview animation state
    this.previewTick = 0;
    this.previewWingPhase = 0;
    this.previewAnimationId = null;
    this.previewImageObj = null;

    if (this.customSkin && this.customSkin.customImage) {
      this.loadPreviewImage(this.customSkin.customImage);
    }

    this.init();
  }

  loadPreviewImage(src) {
    if (!src) {
      this.previewImageObj = null;
      return;
    }
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.previewImageObj = img;
    };
  }

  loadCustomSkin() {
    try {
      const saved = localStorage.getItem('flappy_custom_skin');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }

    return {
      id: 'user_custom',
      name: 'My Custom Bird',
      bodyColor: '#38bdf8',
      bellyColor: '#bae6fd',
      wingColor: '#ffffff',
      beakColor: '#f97316',
      outlineColor: '#0369a1',
      accessory: 'sunglasses',
      customImage: null
    };
  }

  getActiveSkin() {
    if (this.activeSkinId === 'user_custom') {
      return this.customSkin;
    }
    const found = PRESET_SKINS.find(s => s.id === this.activeSkinId);
    return found || PRESET_SKINS[0];
  }

  init() {
    this.renderPresetsGrid();
    this.initEvents();
    this.syncCustomForm();
  }

  initEvents() {
    // Modal Close
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    // Tabs
    if (this.tabPresetsBtn) {
      this.tabPresetsBtn.addEventListener('click', () => this.switchTab('presets'));
    }
    if (this.tabCustomBtn) {
      this.tabCustomBtn.addEventListener('click', () => this.switchTab('custom'));
    }

    // Color pickers real-time preview
    [this.colorBody, this.colorBelly, this.colorWing, this.colorBeak].forEach(picker => {
      if (picker) {
        picker.addEventListener('input', () => {
          this.updateCustomFromForm();
        });
      }
    });

    // Accessory chips
    if (this.accessoryChips) {
      this.accessoryChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-btn');
        if (!btn) return;
        this.accessoryChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.customSkin.accessory = btn.getAttribute('data-accessory');
      });
    }

    // Custom image upload
    if (this.imageUpload) {
      this.imageUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          this.customSkin.customImage = event.target.result;
          this.loadPreviewImage(event.target.result);
          if (this.removeImageBtn) this.removeImageBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });
    }

    // Remove custom image
    if (this.removeImageBtn) {
      this.removeImageBtn.addEventListener('click', () => {
        this.customSkin.customImage = null;
        this.loadPreviewImage(null);
        if (this.imageUpload) this.imageUpload.value = '';
        this.removeImageBtn.classList.add('hidden');
      });
    }

    // Save & Equip Custom Skin
    if (this.saveCustomBtn) {
      this.saveCustomBtn.addEventListener('click', () => {
        this.updateCustomFromForm();
        this.saveCustomSkin();
        this.equipSkin('user_custom');
        this.close();
      });
    }
  }

  switchTab(tab) {
    if (tab === 'presets') {
      this.tabPresetsBtn.classList.add('active');
      this.tabCustomBtn.classList.remove('active');
      this.presetsView.classList.remove('hidden');
      this.customView.classList.add('hidden');
      this.stopPreviewLoop();
    } else {
      this.tabCustomBtn.classList.add('active');
      this.tabPresetsBtn.classList.remove('active');
      this.customView.classList.remove('hidden');
      this.presetsView.classList.add('hidden');
      this.startPreviewLoop();
    }
  }

  renderPresetsGrid() {
    if (!this.presetsGrid) return;
    this.presetsGrid.innerHTML = '';

    PRESET_SKINS.forEach(skin => {
      const card = document.createElement('div');
      card.className = `skin-card ${this.activeSkinId === skin.id ? 'active' : ''}`;
      card.setAttribute('data-id', skin.id);

      card.innerHTML = `
        <div class="skin-mini-preview" style="background: ${skin.bodyColor};">
          <div class="skin-mini-wing" style="background: ${skin.wingColor};"></div>
          <div class="skin-mini-beak" style="background: ${skin.beakColor};"></div>
        </div>
        <div class="skin-card-info">
          <span class="skin-name">${skin.name}</span>
          <span class="skin-status">${this.activeSkinId === skin.id ? 'EQUIPPED' : 'EQUIP'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.equipSkin(skin.id);
      });

      this.presetsGrid.appendChild(card);
    });

    // Custom skin card in presets grid
    const customCard = document.createElement('div');
    customCard.className = `skin-card skin-card-custom ${this.activeSkinId === 'user_custom' ? 'active' : ''}`;
    customCard.setAttribute('data-id', 'user_custom');
    customCard.innerHTML = `
      <div class="skin-mini-preview" style="background: ${this.customSkin.bodyColor}; border: 2px dashed #38bdf8;">
        <span style="font-size: 14px;">✨</span>
      </div>
      <div class="skin-card-info">
        <span class="skin-name">Custom Skin</span>
        <span class="skin-status">${this.activeSkinId === 'user_custom' ? 'EQUIPPED' : 'CUSTOMIZE'}</span>
      </div>
    `;

    customCard.addEventListener('click', () => {
      if (this.activeSkinId === 'user_custom') {
        this.switchTab('custom');
      } else {
        this.equipSkin('user_custom');
      }
    });

    this.presetsGrid.appendChild(customCard);
  }

  equipSkin(skinId) {
    this.activeSkinId = skinId;
    localStorage.setItem('flappy_active_skin_id', skinId);

    this.renderPresetsGrid();

    const activeSkin = this.getActiveSkin();
    if (this.onSkinChange) {
      this.onSkinChange(activeSkin);
    }
  }

  syncCustomForm() {
    if (this.colorBody) this.colorBody.value = this.customSkin.bodyColor || '#38bdf8';
    if (this.colorBelly) this.colorBelly.value = this.customSkin.bellyColor || '#bae6fd';
    if (this.colorWing) this.colorWing.value = this.customSkin.wingColor || '#ffffff';
    if (this.colorBeak) this.colorBeak.value = this.customSkin.beakColor || '#f97316';

    if (this.accessoryChips) {
      this.accessoryChips.querySelectorAll('.chip-btn').forEach(btn => {
        const acc = btn.getAttribute('data-accessory');
        btn.classList.toggle('active', acc === (this.customSkin.accessory || 'none'));
      });
    }

    if (this.removeImageBtn) {
      this.removeImageBtn.classList.toggle('hidden', !this.customSkin.customImage);
    }
  }

  updateCustomFromForm() {
    if (this.colorBody) this.customSkin.bodyColor = this.colorBody.value;
    if (this.colorBelly) this.customSkin.bellyColor = this.colorBelly.value;
    if (this.colorWing) this.customSkin.wingColor = this.colorWing.value;
    if (this.colorBeak) this.customSkin.beakColor = this.colorBeak.value;
  }

  saveCustomSkin() {
    try {
      localStorage.setItem('flappy_custom_skin', JSON.stringify(this.customSkin));
    } catch {
      // Storage quota guard
    }
  }

  open() {
    if (this.modal) this.modal.classList.remove('hidden');
    this.renderPresetsGrid();
    this.syncCustomForm();
    if (this.tabCustomBtn && this.tabCustomBtn.classList.contains('active')) {
      this.startPreviewLoop();
    }
    if (this.onOpen) this.onOpen();
  }

  close() {
    if (this.modal) this.modal.classList.add('hidden');
    this.stopPreviewLoop();
    if (this.onClose) this.onClose();
  }

  startPreviewLoop() {
    this.stopPreviewLoop();
    const loop = () => {
      this.renderPreview();
      this.previewAnimationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopPreviewLoop() {
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }
  }

  renderPreview() {
    if (!this.previewCtx || !this.previewCanvas) return;
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Soft animated bob
    this.previewTick++;
    if (this.previewTick % 6 === 0) {
      this.previewWingPhase = (this.previewWingPhase + 1) % 4;
    }
    const bobY = Math.sin(this.previewTick * 0.08) * 4;

    ctx.save();
    ctx.translate(w / 2, h / 2 + bobY);

    // Draw custom bird preview
    this.drawPreviewBird(ctx, this.customSkin, this.previewWingPhase);

    ctx.restore();
  }

  drawPreviewBird(ctx, skin, wingPhase) {
    const width = 36;
    const height = 26;

    if (this.previewImageObj && this.previewImageObj.complete && this.previewImageObj.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.previewImageObj, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = skin.outlineColor || '#543847';
      ctx.stroke();
    } else {
      // Body
      ctx.fillStyle = skin.bodyColor || '#ffcf10';
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = skin.outlineColor || '#543847';
      ctx.stroke();

      // Belly Accent
      ctx.fillStyle = skin.bellyColor || '#fff4a3';
      ctx.beginPath();
      ctx.ellipse(-2, 3, width / 3, height / 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      const eyeX = 7;
      const eyeY = -4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#543847';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(eyeX + 2, eyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX + 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eyeX + 2, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = skin.beakColor || '#f85800';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(18, 3);
    ctx.lineTo(9, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wing
    let wingOffsetY = 0;
    let wingTilt = 0;
    if (wingPhase === 0) { wingOffsetY = 3; wingTilt = 0.2; }
    else if (wingPhase === 2) { wingOffsetY = -4; wingTilt = -0.3; }

    ctx.save();
    ctx.translate(-7, 1 + wingOffsetY);
    ctx.rotate(wingTilt);
    ctx.fillStyle = skin.wingColor || '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // Accessory
    this.drawAccessory(ctx, skin.accessory);
  }

  drawAccessory(ctx, accessory) {
    if (!accessory || accessory === 'none') return;

    if (accessory === 'sunglasses') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(4, -7, 13, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -7, 13, 6);

      // Lens glare
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(6, -6, 2, 2);
      ctx.fillRect(12, -6, 2, 2);
    } else if (accessory === 'crown') {
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(-8, -20);
      ctx.lineTo(-2, -15);
      ctx.lineTo(3, -22);
      ctx.lineTo(8, -15);
      ctx.lineTo(14, -20);
      ctx.lineTo(12, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ruby jewel
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(3, -16, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'halo') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(2, -18, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (accessory === 'bow') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-4, -13, 4, 0, Math.PI * 2);
      ctx.arc(6, -13, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe4e6';
      ctx.beginPath();
      ctx.arc(1, -13, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'cap') {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(2, -11, 12, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(6, -10, 10, 2.5);
    }
  }
}
