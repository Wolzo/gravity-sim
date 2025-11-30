import { clamp } from '../../shared/math/MathUtils.js';

export class Camera {
  constructor(eventBus, { x = 0, y = 0, zoom = 1, minZoom = 0.02, maxZoom = 5 } = {}) {
    this.eventBus = eventBus;
    this.position = { x, y };
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.viewport = { width: 0, height: 0 };
    this.followTarget = null;
    this._initEvents();
  }

  _initEvents() {
    this.eventBus.on('camera:set-position', ({ dx, dy, zoom }) => {
      if (zoom) this.zoom = zoom;
      this._move(dx, dy);
    });

    this.eventBus.on('camera:set-zoom', ({ sx, sy, zoomFactor }) =>
      this._zoomAt(sx, sy, zoomFactor)
    );

    this.eventBus.on('window:resize', ({ width, height }) => this._setViewport(width, height));

    this.eventBus.on('camera:request-world', ({ sx, sy, callback }) =>
      callback(this._toWorld(sx, sy))
    );
    this.eventBus.on('camera:request-screen', ({ x, y, callback }) =>
      callback(this._toScreen(x, y))
    );

    this.eventBus.on('interaction:select', (body) => (this.followTarget = body || null));
    this.eventBus.on('frame:render', () => {
      if (this.followTarget) this._followTarget();
    });
  }

  _setViewport(width, height) {
    this.viewport.width = width;
    this.viewport.height = height;
  }

  _toScreen(x, y) {
    const cx = this.viewport.width / 2;
    const cy = this.viewport.height / 2;
    return { x: (x - this.position.x) * this.zoom + cx, y: (y - this.position.y) * this.zoom + cy };
  }

  _toWorld(sx, sy) {
    const cx = this.viewport.width / 2;
    const cy = this.viewport.height / 2;
    return {
      x: (sx - cx) / this.zoom + this.position.x,
      y: (sy - cy) / this.zoom + this.position.y,
    };
  }

  _move(dx, dy) {
    this.position.x += dx / this.zoom;
    this.position.y += dy / this.zoom;
    this.eventBus.emit('camera:moved', {
      position: this.position,
      zoom: this.zoom,
      toString: this._getCameraPositionString(),
    });
  }

  _zoomAt(sx, sy, factor) {
    const oldZoom = this.zoom;
    const newZoom = clamp(oldZoom * factor, this.minZoom, this.maxZoom);
    if (newZoom === oldZoom) return;

    const before = this._toWorld(sx, sy);
    this.zoom = newZoom;
    const after = this._toWorld(sx, sy);

    this.position.x += before.x - after.x;
    this.position.y += before.y - after.y;

    this.eventBus.emit('camera:zoomed', {
      position: this.position,
      zoom: this.zoom,
      toString: this._getCameraPositionString(),
    });
  }

  _followTarget() {
    const t = this.followTarget;
    if (!t || !t.position) return;

    this.position.x = t.position.x;
    this.position.y = t.position.y;

    this.eventBus.emit('camera:moved', {
      position: this.position,
      zoom: this.zoom,
      toString: this._getCameraPositionString(),
    });
  }

  _getCameraPositionString() {
    return `x: ${this.position.x.toFixed(2)} y: ${this.position.y.toFixed(2)} zoom: ${this.zoom.toFixed(2)}`;
  }
}
