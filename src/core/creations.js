import { Vec2 } from './vector2.js';
import { Body } from './body.js';
import { massFromRadius } from './config.js';
import { clamp, randomColor } from '../utils/utils.js';

const CREATION_STATES = {
  IDLE: 'IDLE',
  RADIUS: 'RADIUS',
  VELOCITY: 'VELOCITY',
};

export class CreationController {
  constructor(simulation, canvas, hud, camera) {
    this.simulation = simulation;
    this.canvas = canvas;
    this.hud = hud;
    this.camera = camera;

    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMouse = null;
    this.velocityScale = 0.05;

    this.hudElement = document.getElementById('hud');

    this.minRadius = 5;
    this.maxRadius = 160;
    this.minArrowLength = 0;
    this.maxArrowLength = 600;

    this.isPanning = false;
    this.lastPanScreen = null;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this._attachEventListeners();
  }

  _isInHud(event) {
    if (!this.hudElement) return false;

    const rect = this.hudElement.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  _attachEventListeners() {
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });

    window.addEventListener('keydown', this._onKeyDown);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  _onMouseDown(event) {
    if (this._isInHud(event)) {
      this._reset();
      return;
    }

    if (event.target !== this.canvas) return;

    if (event.button === 2) {
      if (this.mode !== CREATION_STATES.IDLE) {
        this._reset();
      } else {
        this.isPanning = true;
        this.lastPanScreen = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    if (event.button !== 0) return;

    const pos = this._getMousePos(event);

    switch (this.mode) {
      case CREATION_STATES.IDLE:
        this.hud.toggleRunning(true);

        this.mode = CREATION_STATES.RADIUS;
        this.center = pos;
        break;

      case CREATION_STATES.RADIUS:
        this.mode = CREATION_STATES.VELOCITY;
        break;

      case CREATION_STATES.VELOCITY:
        this._finalizeBody(pos);
        this._reset();
        break;
    }
  }

  _onMouseMove(event) {
    if (this.isPanning && this.lastPanScreen) {
      const dxScreen = event.clientX - this.lastPanScreen.x;
      const dyScreen = event.clientY - this.lastPanScreen.y;

      this.lastPanScreen = { x: event.clientX, y: event.clientY };

      const invZoom = 1 / (this.camera?.zoom ?? 1);

      this.camera.position.x -= dxScreen * invZoom;
      this.camera.position.y -= dyScreen * invZoom;

      return;
    }

    const pos = this._getMousePos(event);
    this.lastMouse = pos;

    if (this.mode === CREATION_STATES.RADIUS && this.center) {
      const dist = this._distance(this.center, pos);
      this.radius = clamp(dist, this.minRadius, this.maxRadius);
    }
  }

  _onMouseUp(event) {
    if (event.button === 2) {
      this.isPanning = false;
      this.lastPanScreen = null;
    }
  }

  _onWheel(event) {
    event.preventDefault();

    if (!this.camera) return;

    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.camera.zoomAt(sx, sy, zoomFactor);
  }

  _onKeyDown(event) {
    if (event.key === 'Escape' && this.mode !== CREATION_STATES.IDLE) {
      this._reset();
    }
  }

  _getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    if (!this.camera) {
      return { x: sx, y: sy };
    }

    return this.camera.screenToWorld(sx, sy);
  }

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _finalizeBody(pos) {
    const velocity = {
      x: (pos.x - this.center.x) * this.velocityScale,
      y: (pos.y - this.center.y) * this.velocityScale,
    };

    const mass = massFromRadius(this.radius);
    const body = new Body({
      position: new Vec2(this.center.x, this.center.y),
      velocity: new Vec2(velocity.x, velocity.y),
      mass,
      radius: this.radius,
      color: randomColor(),
    });

    this.simulation.addBody(body);
  }

  _reset() {
    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMouse = null;
    this.hud.toggleRunning(false);
  }

  drawPreview() {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const zoom = this.camera?.zoom ?? 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (
      (this.mode === CREATION_STATES.RADIUS || this.mode === CREATION_STATES.VELOCITY) &&
      this.center &&
      this.radius > 0
    ) {
      const centerScreen = this.camera
        ? this.camera.worldToScreen(this.center.x, this.center.y)
        : this.center;

      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, this.radius * zoom, 0, 2 * Math.PI);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.stroke();
    }

    if (this.mode === CREATION_STATES.VELOCITY && this.center && this.lastMouse) {
      const centerScreen = this.camera
        ? this.camera.worldToScreen(this.center.x, this.center.y)
        : this.center;

      const mouseScreen = this.camera
        ? this.camera.worldToScreen(this.lastMouse.x, this.lastMouse.y)
        : this.lastMouse;

      const dx = mouseScreen.x - centerScreen.x;
      const dy = mouseScreen.y - centerScreen.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0.0001) {
        const clampedLen = clamp(len, this.minArrowLength, this.maxArrowLength);
        const ux = dx / len;
        const uy = dy / len;

        const startX = centerScreen.x;
        const startY = centerScreen.y;
        const endX = centerScreen.x + ux * clampedLen;
        const endY = centerScreen.y + uy * clampedLen;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        const headSize = 10;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - ux * headSize - uy * (headSize * 0.5),
          endY - uy * headSize + ux * (headSize * 0.5)
        );
        ctx.lineTo(
          endX - ux * headSize + uy * (headSize * 0.5),
          endY - uy * headSize - ux * (headSize * 0.5)
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }
}
