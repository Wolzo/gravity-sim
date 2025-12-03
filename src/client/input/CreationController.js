import { Vec2 } from '../../shared/math/Vec2.js';
import { Body } from '../../engine/Body.js';
import { clamp } from '../../shared/math/MathUtils.js';
import { massFromRadius } from '../../shared/config/PhysicsConfig.js';
import { RENDER, CREATION_STATES } from '../../shared/config/RenderConfig.js';

export class CreationController {
  constructor(canvas, eventBus, hudElement) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.hudElement = hudElement;

    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMousePos = null;
    this.velocityScale = 0.05;

    this.isPanning = false;
    this.lastPan = null;
    this.selectedBody = null;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    window.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this._onKeyDown(e));

    this.eventBus.on('ui:clear-selection', () => this._setSelectedBody(null));
  }

  _requestWorldCoord(event, callback) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    this.eventBus.emit('camera:request-world', { sx, sy, callback });
  }

  _requestScreenCoord(x, y, callback) {
    this.eventBus.emit('camera:request-screen', { x, y, callback });
  }

  _requestWorldInfo(callback) {
    this.eventBus.emit('world:request-info', { callback });
  }

  _emitPreview() {
    this.eventBus.emit('creation:preview', {
      mode: this.mode,
      center: this.center,
      radius: this.radius,
      lastMousePos: this.lastMousePos,
    });
  }

  _clearPreview() {
    this.eventBus.emit('creation:preview', null);
  }

  _onKeyDown(event) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width / 2;
    const sy = rect.height / 2;

    switch (event.code) {
      case 'Space':
        this.eventBus.emit('sim:toggle');
        break;
      case 'KeyR':
        this.eventBus.emit('sim:reset');
        break;
      case 'Escape':
        if (this.mode !== CREATION_STATES.IDLE) this._reset();
        break;
      case 'Delete':
      case 'Backspace':
        if (this.selectedBody) {
          this._setSelectedBody(null);
          this.eventBus.emit('world:remove-body', this.selectedBody);
        }
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.eventBus.emit('camera:set-position', { dx: 0, dy: -20 });
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.eventBus.emit('camera:set-position', { dx: 0, dy: 20 });
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.eventBus.emit('camera:set-position', { dx: -20, dy: 0 });
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.eventBus.emit('camera:set-position', { dx: 20, dy: 0 });
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.eventBus.emit('camera:set-zoom', { sx, sy, zoomFactor: 1.1 });
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.eventBus.emit('camera:set-zoom', { sx, sy, zoomFactor: 0.9 });
        break;
    }
  }

  _onMouseDown(event) {
    if (this._isInHud(event)) return;

    if (event.button === 2) {
      if (this.mode !== CREATION_STATES.IDLE) {
        this._reset();
      } else {
        this.isPanning = true;
        this.lastPan = { x: event.clientX, y: event.clientY };
        this._setSelectedBody(null);
      }
      return;
    }

    if (event.button !== 0) return;

    this._requestWorldCoord(event, (pos) => {
      if (this.mode === CREATION_STATES.IDLE) {
        this._pickBody(pos, (hit) => {
          if (hit) return this._setSelectedBody(hit);
          if (this.selectedBody) return this._setSelectedBody(null);

          this.mode = CREATION_STATES.RADIUS;
          this.center = pos;
          this.radius = 0;

          this.eventBus.emit('sim:pause');
          this.eventBus.emit('ui:lock', true);
          this._emitPreview();
        });
      } else if (this.mode === CREATION_STATES.RADIUS) {
        this.mode = CREATION_STATES.VELOCITY;
        this._emitPreview();
      } else if (this.mode === CREATION_STATES.VELOCITY) {
        this._finalizeBody(pos);
        this._reset();
      }
    });
  }

  _onMouseMove(event) {
    if (this.isPanning) {
      const dx = event.clientX - this.lastPan.x;
      const dy = event.clientY - this.lastPan.y;
      this.lastPan = { x: event.clientX, y: event.clientY };
      this.eventBus.emit('camera:set-position', { dx: -dx, dy: -dy });
      return;
    }

    this._requestWorldCoord(event, (pos) => {
      this.lastMousePos = pos;
      if (this.mode === CREATION_STATES.RADIUS && this.center) {
        this.radius = clamp(
          Math.hypot(pos.x - this.center.x, pos.y - this.center.y),
          RENDER.CREATION_RADIUS_MIN,
          RENDER.CREATION_RADIUS_MAX
        );
      }
      this._emitPreview();
    });
  }

  _onMouseUp(event) {
    if (event.button === 2) {
      this.isPanning = false;
      this.lastPan = null;
    }
  }

  _onWheel(event) {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.eventBus.emit('camera:set-zoom', { sx, sy, zoomFactor });
  }

  _isInHud(event) {
    if (!this.hudElement) return false;
    const rect = this.hudElement.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  _pickBody(pos, callback) {
    this._requestWorldInfo((info) => {
      const bodies = info.bodies || [];
      let foundBody = null;

      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        const dist = Math.hypot(pos.x - b.position.x, pos.y - b.position.y);
        if (dist <= b.radius) {
          foundBody = b;
          break;
        }
      }

      callback(foundBody);
    });
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

    this.eventBus.emit('world:add-body', body);
  }

  _setSelectedBody(body) {
    this.selectedBody = body || null;
    this.eventBus.emit('interaction:select', this.selectedBody);
  }

  _reset() {
    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.eventBus.emit('ui:lock', false);
    this._clearPreview();

    this.eventBus.emit('sim:resume', true);
  }
}
