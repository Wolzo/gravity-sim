import { Vec2 } from '../../shared/math/Vec2.js';
import { Body } from '../../engine/Body.js';
import { clamp } from '../../shared/math/MathUtils.js';
import { massFromRadius } from '../../shared/config/PhysicsConfig.js';
import { RENDER, CREATION_STATES } from '../../shared/config/RenderConfig.js';

export class CreationController {
  constructor(canvas, world, camera, eventBus, hudElement) {
    this.canvas = canvas;
    this.world = world;
    this.camera = camera;
    this.eventBus = eventBus;
    this.hudElement = hudElement;

    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMousePos = null;
    this.velocityScale = 0.05;

    this.isPanning = false;
    this.lastPanScreen = null;
    this.selectedBody = null;

    this.wasRunningBeforeCreation = null;
    this.isRunning = true;

    this._boundKeyDown = this._onKeyDown.bind(this);

    this._bindEvents();
  }

  _isInHud(event) {
    if (!this.hudElement) return false;

    const rect = this.hudElement.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this._boundKeyDown);

    this.eventBus.on('ui:clear-selection', () => this._setSelectedBody(null));
    this.eventBus.on('simulation:state-changed', (isRunning) => {
      this.isRunning = isRunning;
    });
  }

  _setSelectedBody(body) {
    this.selectedBody = body || null;
    this.eventBus.emit('interaction:select', this.selectedBody);
    if (!body) {
      this.camera.setFollowTarget(null);
    }
  }

  _onKeyDown(event) {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const rect = this.canvas.getBoundingClientRect();
    const sxCenter = rect.width / 2;
    const syCenter = rect.height / 2;

    switch (event.code) {
      case 'Space':
        this.isRunning = !this.isRunning;
        this.eventBus.emit('ui:toggle');
        break;
      case 'KeyR':
        this.eventBus.emit('ui:reset');
        break;
      case 'Escape':
        if (this.mode !== CREATION_STATES.IDLE) this._reset();
        break;
      case 'Delete':
      case 'Backspace':
        if (this.selectedBody) {
          this.world.removeBody(this.selectedBody);
          this._setSelectedBody(null);
        }
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.camera.move(0, -20 / this.camera.zoom);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.camera.move(0, 20 / this.camera.zoom);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.camera.move(-20 / this.camera.zoom, 0);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.camera.move(20 / this.camera.zoom, 0);
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.camera.zoomAt(sxCenter, syCenter, 1.1);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.camera.zoomAt(sxCenter, syCenter, 0.9);
        break;
    }
  }

  _onMouseDown(event) {
    if (this._isInHud(event)) return;
    if (event.target !== this.canvas) return;

    const pos = this._getMousePosWorld(event);

    if (event.button === 2) {
      if (this.mode !== CREATION_STATES.IDLE) {
        this._reset();
      } else {
        this.isPanning = true;
        this.lastPanScreen = { x: event.clientX, y: event.clientY };
        this.camera.setFollowTarget(null);
      }

      return;
    }

    if (event.button !== 0) return;

    if (this.mode === CREATION_STATES.IDLE) {
      const hit = this._pickBody(pos);
      if (hit) {
        this._setSelectedBody(hit);
        this.camera.setFollowTarget(hit);
        return;
      }
      if (this.selectedBody) {
        this._setSelectedBody(null);
        return;
      }

      this.mode = CREATION_STATES.RADIUS;
      this.center = pos;
      this.wasRunningBeforeCreation = this.isRunning;
      if (this.wasRunningBeforeCreation) {
        this.eventBus.emit('ui:pause');
      }
      this.eventBus.emit('ui:lock', true);
    } else if (this.mode === CREATION_STATES.RADIUS) {
      this.mode = CREATION_STATES.VELOCITY;
    } else if (this.mode === CREATION_STATES.VELOCITY) {
      this._finalizeBody(pos);
      this._reset();
    }
  }

  _onMouseMove(event) {
    if (this.isPanning && this.lastPanScreen) {
      const dxScreen = event.clientX - this.lastPanScreen.x;
      const dyScreen = event.clientY - this.lastPanScreen.y;
      this.lastPanScreen = { x: event.clientX, y: event.clientY };
      const invZoom = 1 / this.camera.zoom;
      this.camera.move(-dxScreen * invZoom, -dyScreen * invZoom);
      return;
    }

    this.lastMousePos = this._getMousePosWorld(event);

    if (this.mode === CREATION_STATES.RADIUS && this.center) {
      const dist = Math.hypot(
        this.lastMousePos.x - this.center.x,
        this.lastMousePos.y - this.center.y
      );
      this.radius = clamp(dist, RENDER.CREATION_RADIUS_MIN, RENDER.CREATION_RADIUS_MAX);
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
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.camera.zoomAt(sx, sy, zoomFactor);
  }

  _getMousePosWorld(event) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    return this.camera.screenToWorld(sx, sy);
  }

  _pickBody(pos) {
    const bodies = this.world.bodies;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      const dist = Math.hypot(pos.x - b.position.x, pos.y - b.position.y);
      if (dist <= b.radius) return b;
    }
    return null;
  }

  _finalizeBody(currentPos) {
    if (this.radius < RENDER.CREATION_RADIUS_MIN) return;

    const velocity = {
      x: (currentPos.x - this.center.x) * this.velocityScale,
      y: (currentPos.y - this.center.y) * this.velocityScale,
    };

    const mass = massFromRadius(this.radius);

    const body = new Body({
      position: new Vec2(this.center.x, this.center.y),
      velocity: new Vec2(velocity.x, velocity.y),
      mass,
      radius: this.radius,
    });

    this.world.addBody(body);
  }

  _reset() {
    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.eventBus.emit('ui:lock', false);

    if (this.wasRunningBeforeCreation) {
      this.eventBus.emit('ui:resume');
    }
    this.wasRunningBeforeCreation = null;
  }

  drawPreview() {
    if (this.mode === CREATION_STATES.IDLE || !this.center) return;

    const ctx = this.canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const zoom = this.camera.zoom;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerScreen = this.camera.worldToScreen(this.center.x, this.center.y);

    if (this.radius > 0) {
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, this.radius * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = RENDER.COLOR_PREVIEW_FILL;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = RENDER.COLOR_PREVIEW_STROKE;
      ctx.stroke();
    }

    if (this.mode === CREATION_STATES.VELOCITY && this.lastMousePos) {
      const mouseScreen = this.camera.worldToScreen(this.lastMousePos.x, this.lastMousePos.y);

      const dx = mouseScreen.x - centerScreen.x;
      const dy = mouseScreen.y - centerScreen.y;
      const len = Math.hypot(dx, dy);

      if (len > 10) {
        const clampedLen = clamp(len, RENDER.CREATION_VELOCITY_MIN, RENDER.CREATION_VELOCITY_MAX);
        const ux = dx / len;
        const uy = dy / len;

        const startX = centerScreen.x;
        const startY = centerScreen.y;
        const endX = centerScreen.x + ux * clampedLen;
        const endY = centerScreen.y + uy * clampedLen;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = RENDER.COLOR_ARROW;
        ctx.stroke();

        const headSize = 8;
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
        ctx.fillStyle = RENDER.COLOR_ARROW;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
