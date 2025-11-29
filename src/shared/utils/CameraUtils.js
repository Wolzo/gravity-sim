import { clamp } from '../math/MathUtils.js';
/**
 * Positions the camera so that a given world-space point is at the center
 * of the canvas, with the desired zoom.
 * `options`:
 *  - center: { x, y } in world space
 *  - zoom: desired zoom level
 */
export function configureCameraForSeed(renderer, { center, zoom }) {
  const camera = renderer?.camera;
  const canvas = renderer?.canvas;
  if (!camera || !canvas) return;

  const rect = canvas.getBoundingClientRect();

  const zMin = typeof camera.minZoom === 'number' ? camera.minZoom : 0.0001;
  const zMax = typeof camera.maxZoom === 'number' ? camera.maxZoom : Infinity;
  const z = clamp(zoom, zMin, zMax);

  camera.zoom = z;

  const cx = center?.x ?? rect.width / 2;
  const cy = center?.y ?? rect.height / 2;

  camera.position.x = cx - rect.width / (2 * z);
  camera.position.y = cy - rect.height / (2 * z);

  if (typeof camera.setFollowTarget === 'function') {
    camera.setFollowTarget(null);
  }
}
