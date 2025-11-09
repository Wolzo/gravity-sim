import { EARTH_MASS_UNITS } from '../core/config.js';
import { pseudoRandom } from './utils.js';

/**
 * Color utility for bodies.
 *
 * Colors are chosen from small, hand-picked pastel palettes
 * that are loosely inspired by real Solar System bodies:
 *
 *  - "star"     -> bright warm whites / yellows
 *  - "gasGiant" -> Jupiter / Saturn / Neptune-like tones
 *  - "rocky"    -> Earth blue, Mars red, Venus/Mercury beiges
 *  - "debris"   -> various rock/grey tones
 *
 * The main entry point is:
 *
 *   colorForBody({ mass, velocity, kind? })
 *
 * where:
 *   - mass      : body mass in simulation units
 *   - velocity  : { x, y } velocity vector (used only as a seed for variety)
 *   - kind      : optional override ('star' | 'gasGiant' | 'rocky' | 'debris')
 *
 * If kind is not provided, the body type is inferred from
 * mass / EARTH_MASS_UNITS so all seeds and user-created
 * bodies share the same physical scale.
 */

const PALETTES = {
  star: [
    '#fff7e6', // very bright, almost white
    '#ffe9c4', // warm soft yellow
    '#fff3cf', // pale yellow
  ],
  gasGiant: [
    '#d3b58b', // Jupiter-like brown/beige
    '#e2c8a5', // Saturn-like paler beige
    '#9fc3d8', // Neptune/Uranus bluish-cyan
    '#c5d1e0', // softer cold giant
  ],
  rocky: [
    '#466d9d', // Earth-like blue
    '#c96a5a', // Mars-like reddish
    '#d1c3b2', // Mercury/Venus beige
    '#7d8a99', // generic rocky/grey-blue
  ],
  debris: [
    '#8b929e', // dark rock grey
    '#a1a8b3', // medium grey
    '#767d88', // darker fragments
    '#b0b7c2', // lighter dust
  ],
};

/**
 * Classify a body type based on mass relative to an Earth-like body.
 */
function classifyBodyType(mass) {
  const m = Math.max(mass || 1, 1e-12);
  const ratio = m / EARTH_MASS_UNITS;

  if (ratio >= 200) return 'star';
  if (ratio >= 20) return 'gasGiant';
  if (ratio >= 0.05) return 'rocky';
  return 'debris';
}

/**
 * Choose a color from the palette of the given type, using
 * a deterministic seed based on mass and speed.
 */
function pickColorFromPalette(type, mass, velocity) {
  const palette = PALETTES[type] || PALETTES.debris;

  let speed = 0;
  if (velocity && Number.isFinite(velocity.x) && Number.isFinite(velocity.y)) {
    speed = Math.hypot(velocity.x, velocity.y);
  }

  const seed = pseudoRandom(mass || 1, speed || 0);
  const idx = Math.floor(seed * palette.length) % palette.length;

  return palette[idx];
}

export function colorForBody({ mass, velocity, kind } = {}) {
  const type = kind || classifyBodyType(mass);
  return pickColorFromPalette(type, mass, velocity);
}
