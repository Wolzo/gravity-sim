import { clamp } from '../../shared/math/MathUtils.js';

export class Camera {
  /**
   * Manages the viewport, zoom level, and coordinate conversion (World <-> Screen).
   * Uses "Center Origin" logic: camera.position corresponds to the center of the viewport.
   */
  constructor(eventBus, { x = 0, y = 0, zoom = 1, minZoom = 0.02, maxZoom = 5 } = {}) {
    this.eventBus = eventBus;
    this.position = { x, y };
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.followTarget = null;
    this.viewport = { width: 0, height: 0 };
  }

  setViewport(width, height) {
    this.viewport.width = width;
    this.viewport.height = height;
  }

  worldToScreen(x, y, target = { x: 0, y: 0 }) {
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;

    target.x = (x - this.position.x) * this.zoom + centerX;
    target.y = (y - this.position.y) * this.zoom + centerY;
    return target;
  }

  screenToWorld(sx, sy, target = { x: 0, y: 0 }) {
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;

    target.x = (sx - centerX) / this.zoom + this.position.x;
    target.y = (sy - centerY) / this.zoom + this.position.y;
    return target;
  }

  move(dx, dy) {
    this.position.x += dx;
    this.position.y += dy;

    this.eventBus.emit('camera:move', {
      position: this.position,
      zoom: this.zoom,
      followTarget: this.followTarget,
      positionString: this.getCameraPositionString(),
    });
  }

  zoomAt(sx, sy, factor) {
    const oldZoom = this.zoom;
    let newZoom = oldZoom * factor;
    newZoom = clamp(newZoom, this.minZoom, this.maxZoom);

    if (newZoom === oldZoom) return;

    const mouseWorldBefore = this.screenToWorld(sx, sy);

    this.zoom = newZoom;

    const mouseWorldAfter = this.screenToWorld(sx, sy);

    this.position.x += mouseWorldBefore.x - mouseWorldAfter.x;
    this.position.y += mouseWorldBefore.y - mouseWorldAfter.y;

    this.eventBus.emit('camera:zoom', {
      position: this.position,
      zoom: this.zoom,
      followTarget: this.followTarget,
      positionString: this.getCameraPositionString(),
    });
  }

  setFollowTarget(body) {
    this.followTarget = body || null;
  }

  getCameraPositionString() {
    return `x: ${this.position.x.toFixed(2)} y: ${this.position.y.toFixed(2)} zoom: ${this.zoom.toFixed(2)}`;
  }
}
