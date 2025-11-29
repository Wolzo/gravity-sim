import { formatValue } from '../../shared/math/MathUtils.js';

const SPEED_VALUES = [0.5, 1, 2, 5];

export class HUD {
  constructor(renderer, eventBus, seeds, defaultSeedKey) {
    this.renderer = renderer;
    this.eventBus = eventBus;
    this.seeds = seeds;
    this.currentSeedKey = defaultSeedKey;

    this.timeScale = 1;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.selectedBody = null;

    this.btnToggle = document.getElementById('btn-toggle');
    this.iconToggle = document.getElementById('icon-toggle');
    this.btnReset = document.getElementById('btn-reset');
    this.fpsCounter = document.getElementById('fps-counter');
    this.bodiesCounter = document.getElementById('bodies-counter');
    this.collisionCounter = document.getElementById('collisions-counter');
    this.cameraPosition = document.getElementById('camera-position');
    this.speedSlider = document.getElementById('speed-slider');
    this.hudSpeedValue = document.getElementById('hud-speed-value');
    this.seedSelect = document.getElementById('seed-select');
    this.tooltipEl = document.getElementById('body-tooltip');

    this.initDOM();
    this.initEvents();
    this.applyInitialSpeed();
    this.populateSeedSelect();
  }

  initDOM() {
    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', () => this.toggleRunning());
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.resetSim());
    }

    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', () => {
        const raw = parseInt(this.speedSlider.value);
        const idx = Number.isFinite(raw) ? raw : 0;
        const clampedIdx = Math.max(0, Math.min(SPEED_VALUES.length - 1, idx));

        const newScale = SPEED_VALUES[clampedIdx] ?? 1;

        if (newScale === this.timeScale) return;

        this.timeScale = newScale;

        if (this.hudSpeedValue) {
          this.hudSpeedValue.textContent = String(this.timeScale);
        }

        this.eventBus.emit('ui:timeScale', this.timeScale);
      });
    }

    if (this.seedSelect) {
      this.seedSelect.addEventListener('change', () => {
        this.currentSeedKey = this.seedSelect.value;
        this.resetSim();
      });
    }
  }

  applyInitialSpeed() {
    if (this.speedSlider) {
      const idx = Number(this.speedSlider.value) || 0;
      this.timeScale = SPEED_VALUES[idx] ?? 1;
      if (this.hudSpeedValue) {
        this.hudSpeedValue.textContent = this.timeScale.toString();
      }

      this.eventBus.emit('ui:timeScale', this.timeScale);
    }
  }

  populateSeedSelect() {
    if (!this.seedSelect) return;

    this.seedSelect.innerHTML = '';
    Object.entries(this.seeds).forEach(([key, cfg]) => {
      if (cfg.enabled === false) return;

      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cfg.label ?? key;
      this.seedSelect.appendChild(opt);
    });

    this.seedSelect.value = this.currentSeedKey;
  }

  initEvents() {
    this.eventBus.on('world:collision', (data) => this.updateCollisionCounter(data));
    this.eventBus.on('world:step', (data) => this.updateBodiesCounter(data));
    this.eventBus.on('world:cleared', (data) => this.updateCollisionCounter(data));
    this.eventBus.on('ui:lock', (disabled) => this.setControlsDisabled(disabled));
    this.eventBus.on('interaction:select', (body) => this.selectBody(body));
    this.eventBus.on('frame:render', (dt) => this._updateFPS(dt));
    this.eventBus.on('ui:pause', () => this.updatePlayPauseIcon(false));
    this.eventBus.on('ui:resume', () => this.updatePlayPauseIcon(true));
    this.eventBus.on('camera:move', (data) => {
      this._updateCameraString(data);
    });
    this.eventBus.on('camera:zoom', (data) => {
      this._updateCameraString(data);
    });
    this.eventBus.on('tooltip:update-tooltip', (bodyInfo) => this.updateTooltip(bodyInfo));
  }

  updateCollisionCounter(collisionSummary) {
    if (this.collisionCounter) {
      this.collisionCounter.textContent = collisionSummary.collisionCount.toString();
    }
  }

  updateBodiesCounter(data) {
    if (this.bodiesCounter) this.bodiesCounter.textContent = data.bodyCount.toString();
  }

  setControlsDisabled(disabled) {
    if (this.btnToggle) this.btnToggle.disabled = disabled;
    if (this.btnReset) this.btnReset.disabled = disabled;
  }

  selectBody(body) {
    this.selectedBody = body || null;
    this.renderer.setSelectedBody(body);
  }

  _updateFPS(dt) {
    this.frameCount++;
    this.fpsTimer += dt;

    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;

      if (this.fpsCounter) this.fpsCounter.textContent = String(this.fps);
    }
  }

  _updateCameraString(camera) {
    if (!this.cameraPosition) return;
    this.cameraPosition.textContent = camera.positionString;
  }

  updateTooltip(bodyInfo) {
    if (!this.tooltipEl) return;

    if (!bodyInfo) {
      this.tooltipEl.style.display = 'none';
      return;
    }

    const { screenX, screenY, name, mass, velocity } = bodyInfo;
    const canvas = this.renderer.canvas;
    const rect = canvas.getBoundingClientRect();

    if (screenX < 0 || screenY < 0 || screenX > rect.width || screenY > rect.height) {
      this.tooltipEl.style.display = 'none';
      return;
    }

    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${rect.left + screenX}px`;
    this.tooltipEl.style.top = `${rect.top + screenY}px`;

    const speed = velocity.length();
    const kinetic = 0.5 * mass * speed * speed;

    this.tooltipEl.innerHTML =
      `<strong>${name}</strong><br>` +
      `m = ${formatValue(mass)}<br>` +
      `|v| = ${formatValue(speed)}<br>` +
      `K = ${formatValue(kinetic)}`;
  }

  toggleRunning() {
    this.eventBus.emit('ui:toggle');
  }

  updatePlayPauseIcon(running) {
    if (running) {
      this.iconToggle.setAttribute('d', 'M6 19h4V5H6zm8-14v14h4V5h-4z');
    } else {
      this.iconToggle.setAttribute('d', 'M8 5v14l11-7z');
    }
  }

  resetSim() {
    this.eventBus.emit('ui:reset', this.currentSeedKey);
  }
}
