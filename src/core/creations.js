import { Vec2 } from './vector2.js';
import { Body } from './body.js';
import { massFromRadius } from './config.js';
import { clamp } from '../utils/utils.js';
import {
  CREATION_STATES,
  CREATION_RADIUS_MAX,
  CREATION_RADIUS_MIN,
  CREATION_VELOCITY_MAX,
  CREATION_VELOCITY_MIN,
} from './config.js';

/**
 * Handles interactive body creation on the canvas:
 * - click & drag to set radius and initial velocity
 * - right-click to cancel or pan the camera
 * - notifies the HUD when a body is selected.
 */
export class CreationController {
  constructor(simulation, canvas, hud, camera, hudElement, onBodySelected) {
    this.simulation = simulation;
    this.canvas = canvas;
    this.hud = hud;
    this.camera = camera;

    this.hudElement = hudElement;

    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMouse = null;
    this.velocityScale = 0.05;

    this.onBodySelected = onBodySelected;
    this.selectedBody = null;

    this.minRadius = CREATION_RADIUS_MIN;
    this.maxRadius = CREATION_RADIUS_MAX;
    this.minArrowLength = CREATION_VELOCITY_MIN;
    this.maxArrowLength = CREATION_VELOCITY_MAX;

    this.isPanning = false;
    this.lastPanScreen = null;

    this.wasRunningBeforeCreation = null;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    this._attachEventListeners();
  }

  /**
   * Returns true if the mouse event is currently over the HUD,
   * in which case canvas interactions should be ignored.
   */
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
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);

    window.removeEventListener('keydown', this._onKeyDown);
  }

  /**
   * Main mouse down handler:
   * - right button:
   *     - if a body is selected and click is on empty space -> deselect it
   *     - otherwise pan the camera or cancel the current creation
   * - left button when idle:
   *     - if click hits a body -> select it
   *     - if click is on empty space and a body is selected -> deselect it
   *     - if click is on empty space and no body is selected -> start new body creation
   * - left button during creation:
   *     advance the creation state machine (center -> radius -> velocity -> spawn body)
   */
  _onMouseDown(event) {
    if (this._isInHud(event)) {
      return;
    }

    if (event.target !== this.canvas) return;

    const pos = this._getMousePos(event);
    const hit = this._pickBody(pos);

    if (event.button === 2) {
      if (!hit && this.selectedBody) {
        this._setSelectedBody(null);
        this._reset();
        return;
      }

      if (this.mode !== CREATION_STATES.IDLE) {
        this._reset();
      } else {
        this.isPanning = true;
        this.lastPanScreen = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    if (event.button !== 0) return;

    if (this.mode === CREATION_STATES.IDLE) {
      if (hit) {
        this._setSelectedBody(hit);
        return;
      }

      if (this.selectedBody) {
        this._setSelectedBody(null);
        return;
      }

      this.wasRunningBeforeCreation =
        typeof this.hud.isRunning === 'function' ? this.hud.isRunning() : true;

      if (this.wasRunningBeforeCreation && typeof this.hud.setRunning === 'function') {
        this.hud.setRunning(false);
      }

      if (typeof this.hud.setHudDisabled === 'function') {
        this.hud.setHudDisabled(true);
      }

      this.mode = CREATION_STATES.RADIUS;
      this.center = pos;
      return;
    }

    switch (this.mode) {
      case CREATION_STATES.RADIUS:
        this.mode = CREATION_STATES.VELOCITY;
        break;

      case CREATION_STATES.VELOCITY:
        this._finalizeBody(pos);
        this._reset();
        break;
    }
  }

  /**
   * Mouse move handler:
   * - when panning: moves the camera in world space
   * - when sizing: updates the radius preview for the new body.
   */
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

  /**
   * Mouse up handler:
   * stops panning when the right button is released.
   */
  _onMouseUp(event) {
    if (event.button === 2) {
      this.isPanning = false;
      this.lastPanScreen = null;
    }
  }

  /**
   * Mouse wheel handler:
   * zooms the camera in or out around the cursor position.
   */
  _onWheel(event) {
    event.preventDefault();

    if (!this.camera) return;

    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.camera.zoomAt(sx, sy, zoomFactor);
  }

  /**
   * Prevents the default browser context menu on the simulation canvas.
   */
  _onContextMenu(event) {
    event.preventDefault();
  }

  /**
   * Keyboard handler:
   * ESC cancels the current creation and returns to the idle state.
   */
  _onKeyDown(event) {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sxCenter = rect.width / 2;
    const syCenter = rect.height / 2;

    switch (event.code) {
      case 'Space':
        this.hud.toggleRunning();
        break;

      case 'KeyR':
        this.hud.resetSim();
        break;

      case 'Escape':
        if (this.mode !== CREATION_STATES.IDLE) {
          this._reset();
        }
        break;

      case 'Delete':
      case 'Backspace':
        const body = this.selectedBody;
        if (body) {
          this.simulation.removeBody(body);
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

  /**
   * Converts the mouse event position from screen space (CSS pixels)
   * into world coordinates using the active camera.
   */
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

  _setSelectedBody(body) {
    this.selectedBody = body || null;

    if (typeof this.onBodySelected === 'function') {
      this.onBodySelected(this.selectedBody);
    }
  }

  /**
   * Finalizes the creation of a body:
   * - computes initial velocity from the drag vector
   * - derives mass from the chosen radius
   * - assigns a random color and generated name
   * - adds the body to the simulation.
   */
  _finalizeBody(pos) {
    if (this.radius < this.minRadius) return;

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
    });

    this.simulation.addBody(body);
  }

  /**
   * Resets the creation state back to idle and unpauses the simulation.
   */
  _reset() {
    this.mode = CREATION_STATES.IDLE;
    this.center = null;
    this.radius = 0;
    this.lastMouse = null;

    if (this.hud && typeof this.hud.setHudDisabled === 'function') {
      this.hud.setHudDisabled(false);
    }

    if (this.wasRunningBeforeCreation !== null) {
      if (
        this.wasRunningBeforeCreation &&
        typeof this.hud.isRunning === 'function' &&
        typeof this.hud.setRunning === 'function' &&
        !this.hud.isRunning()
      ) {
        this.hud.setRunning(true);
      }
      this.wasRunningBeforeCreation = null;
    }
  }

  /**
   * Performs a simple hit-test in world space to find the topmost body
   * under the given position, or `null` if none is found.
   */
  _pickBody(pos) {
    const bodies = this.simulation.bodies;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      const dx = pos.x - b.position.x;
      const dy = pos.y - b.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= b.radius) {
        return b;
      }
    }
    return null;
  }

  /**
   * Renders the interactive preview on top of the canvas:
   * - a circle for the body radius
   * - an arrow for the initial velocity vector (if in velocity mode).
   */
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

      if (len > 10) {
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
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }
}
