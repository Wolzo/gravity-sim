import { clamp } from "../utils/utils.js";

/**
 * Simple 2D camera:
 * - position = world coordinates of the top-left corner of the viewport
 * - zoom     = scale factor (1 = 1 world unit = 1 screen pixel)
 */
export class Camera {
  constructor({
    x = 0,
    y = 0,
    zoom = 1,
    minZoom = 0.25,
    maxZoom = 5
  } = {}) {
    this.position = { x, y };
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.position.x) * this.zoom,
      y: (y - this.position.y) * this.zoom
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.position.x,
      y: sy / this.zoom + this.position.y
    };
  }

  zoomAt(sx, sy, factor) {
    const oldZoom = this.zoom;
    let newZoom = oldZoom * factor;
    newZoom = clamp(newZoom, this.minZoom, this.maxZoom);

    if (newZoom === oldZoom) return;

    const before = this.screenToWorld(sx, sy);

    this.zoom = newZoom;

    const after = this.screenToWorld(sx, sy);

    this.position.x += before.x - after.x;
    this.position.y += before.y - after.y;
  }
}
