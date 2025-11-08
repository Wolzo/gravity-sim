import { clamp } from '../utils/utils.js';

/**
 * Simple 2D camera:
 * - position = world coordinates of the top-left corner of the viewport
 * - zoom     = scale factor (1 = 1 world unit = 1 screen pixel)
 */
export class Camera {
  constructor({ x = 0, y = 0, zoom = 1, minZoom = 0.02, maxZoom = 5 } = {}) {
    this.position = { x, y };
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.followTarget = null;
  }

  /**
   * Converts a world-space point into screen-space coordinates (in CSS pixels),
   * taking the camera position and zoom into account.
   */
  worldToScreen(x, y) {
    return {
      x: (x - this.position.x) * this.zoom,
      y: (y - this.position.y) * this.zoom,
    };
  }

  /**
   * Converts screen-space coordinates (CSS pixels relative to the canvas)
   * back into world-space coordinates.
   */
  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.position.x,
      y: sy / this.zoom + this.position.y,
    };
  }

  /**
   * Changes the zoom level around a given screen-space point.
   * Keeps the world point under (sx, sy) fixed in place while zooming.
   */
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

  /**
   * Tells the camera to follow the given body.
   * Pass `null` to stop following any body.
   */
  setFollowTarget(body) {
    this.followTarget = body || null;
  }
}
