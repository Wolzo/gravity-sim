import { PHYSICS, massFromRadius } from '../config/PhysicsConfig.js';
import { pseudoRandom } from '../math/MathUtils.js';

const PALETTES = {
  star: ['#fff7e6', '#ffe9c4', '#fff3cf'],
  gasGiant: ['#d3b58b', '#e2c8a5', '#9fc3d8', '#c5d1e0'],
  rocky: ['#466d9d', '#c96a5a', '#d1c3b2', '#7d8a99'],
  debris: ['#8b929e', '#a1a8b3', '#767d88', '#b0b7c2'],
};

function classifyBodyType(mass) {
  const m = Math.max(mass || 1, 1e-12);
  const ratio = m / massFromRadius(PHYSICS.EARTH_RADIUS_UNITS);

  if (ratio >= 200) return 'star';
  if (ratio >= 20) return 'gasGiant';
  if (ratio >= 0.05) return 'rocky';
  return 'debris';
}

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
