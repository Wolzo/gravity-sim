import { clamp } from './utils.js';

/**
 * Generate physically-meaningful pastel colors for bodies
 * based on their mass (type of object) and velocity (kinetic energy).
 *
 * - Very massive bodies are treated as "stars" → bright warm tones
 * - Massive bodies are "gas giants"           → beige / soft orange
 * - Medium bodies are "rocky planets"         → neutral / bluish
 * - Tiny bodies are "debris / asteroids"      → darker neutral tones
 *
 * Velocity slightly increases saturation and decreases lightness,
 * mimicking higher kinetic energy, but the result stays in a
 * minimal, pastel range.
 */

/**
 * Deterministic pseudo-random number in [0, 1) based on two inputs.
 * Used only for tiny lightness jitter so similar bodies are not identical.
 */
function pseudoRandom(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Convert HSL color to HEX (#rrggbb).
 * h in [0, 360), s and l in [0, 100].
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

/**
 * Classify a body type based on mass using log10(mass).
 * Adjust thresholds to match your typical mass scale.
 *
 * Returns one of: "star" | "gasGiant" | "rocky" | "debris".
 */
function classifyBodyType(mass) {
  const m = Math.max(mass || 1, 1e-12);
  const logM = Math.log10(m);

  // These thresholds assume something like:
  //  - logM >= 7 → star
  //  - 5–7       → gas giant
  //  - 3–5       → rocky planet
  //  - <3        → debris / asteroid
  if (logM >= 7) return 'star';
  if (logM >= 5) return 'gasGiant';
  if (logM >= 3) return 'rocky';
  return 'debris';
}

/**
 * Base HSL parameters for each physical class.
 * All values are kept in a pastel / minimal range.
 */
function getBaseHslForType(type) {
  switch (type) {
    case 'star':
      // Warm, bright, slightly yellow-white
      return { h: 45, s: 55, l: 82 };
    case 'gasGiant':
      // Soft beige / light orange
      return { h: 35, s: 45, l: 75 };
    case 'rocky':
      // Neutral / slightly bluish, not too saturated
      return { h: 210, s: 28, l: 68 };
    case 'debris':
    default:
      // Darker neutral, a hint of blue/grey
      return { h: 220, s: 22, l: 58 };
  }
}

/**
 * Main color generator.
 *
 * @param {Object} params
 * @param {number} params.mass - mass of the body
 * @param {Object} params.velocity - velocity vector { x, y }
 * @returns {string} HEX color
 */
export function colorForBody({ mass, velocity } = {}) {
  const type = classifyBodyType(mass);
  const base = getBaseHslForType(type);

  // Speed magnitude as a proxy for kinetic temperature
  let speed = 0;
  if (velocity && Number.isFinite(velocity.x) && Number.isFinite(velocity.y)) {
    speed = Math.hypot(velocity.x, velocity.y);
  }

  // Normalize speed to [0, 1] for typical ranges in your sim.
  // Tune SPEED_REF if your velocities are much larger/smaller.
  const SPEED_REF = 40;
  const tSpeed = clamp(speed / SPEED_REF, 0, 1);

  // Velocity effect:
  // - Faster → slightly more saturated and darker
  // - Slower → slightly less saturated and lighter
  let sat = base.s + (tSpeed - 0.5) * 16; // ±8 points around base
  let light = base.l - tSpeed * 8; // up to 8 points darker at high speed

  sat = clamp(sat, 18, 60);
  light = clamp(light, 45, 88);

  // Tiny deterministic jitter in lightness so similar bodies are not flat clones.
  const jitter = pseudoRandom(Math.log10(Math.max(mass || 1, 1e-12)), speed || 0);
  const jitterRange = 4; // ±2
  light += (jitter - 0.5) * jitterRange;
  light = clamp(light, 45, 88);

  return hslToHex(base.h, sat, light);
}
