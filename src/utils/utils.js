/**
 * Clamps `value` to the inclusive range [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const colors = [
  '#c2b28f',
  '#e0c896',
  '#6fa8ff',
  '#ff7043',
  '#f2d1a0',
  '#f5e2b8',
  '#9ad9ff',
  '#5b8cff',
];

/**
 * Returns a random color chosen from a predefined palette.
 * Used to quickly give bodies visually distinct colors.
 */
export function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Formats a numeric value for HUD display:
 * - uses scientific notation for very small or very large magnitudes
 * - otherwise chooses a reasonable number of decimal places.
 */
export function formatValue(v) {
  if (!Number.isFinite(v)) return '—';

  const abs = Math.abs(v);
  if (abs === 0) return '0';

  if (abs >= 1e4 || abs < 1e-3) {
    return v.toExponential(2);
  }

  if (abs >= 10) {
    return v.toFixed(1);
  }

  if (abs >= 1) {
    return v.toFixed(2);
  }

  return v.toPrecision(3);
}

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
