/**
 * Pre-rendered radial glow sprites, cached per colour.
 *
 * The previous approach drew three overlapping arcs per body with `shadowBlur` set,
 * which is one of the most expensive operations in Canvas2D and dominated frame time
 * once a handful of large bodies were on screen. Baking the falloff into a texture
 * once per colour turns the per-body cost into a single `drawImage`.
 *
 * A sprite is SIZE x SIZE with the body's own disc occupying CORE_FRACTION of the
 * half-width, so a body of world radius R is drawn at a destination size of
 * `R * 2 / CORE_FRACTION`.
 */
const SIZE = 128;
const CORE_FRACTION = 0.25;

/** Destination size multiplier: world radius -> sprite draw size. */
export const GLOW_SCALE = 2 / CORE_FRACTION;

/** Alpha falloff, sampled at fractions of the sprite's half-width. */
const STOPS = [
  [0.0, 0.55],
  [CORE_FRACTION, 0.3],
  [0.5, 0.1],
  [0.75, 0.03],
  [1.0, 0.0],
];

let probeCtx = null;

/**
 * Normalizes any CSS colour to {r, g, b} by letting the canvas parse it.
 */
function toRgb(color) {
  if (!probeCtx) {
    probeCtx = document.createElement('canvas').getContext('2d');
  }

  probeCtx.fillStyle = '#ffffff';
  probeCtx.fillStyle = color;
  const normalized = probeCtx.fillStyle;

  if (normalized[0] === '#') {
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16),
    };
  }

  const match = normalized.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(',');
    return { r: parseInt(parts[0], 10), g: parseInt(parts[1], 10), b: parseInt(parts[2], 10) };
  }

  return { r: 255, g: 255, b: 255 };
}

export class GlowSprites {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Returns a canvas holding the glow texture for `color`, building it on first use.
   * Bodies share a handful of palette colours, so the cache stays small.
   */
  get(color) {
    const key = color || '#ffffff';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;

    const ctx = canvas.getContext('2d');
    const half = SIZE / 2;
    const { r, g, b } = toRgb(key);

    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    for (const [offset, alpha] of STOPS) {
      gradient.addColorStop(offset, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    this.cache.set(key, canvas);
    return canvas;
  }
}
