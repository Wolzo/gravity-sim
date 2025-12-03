export const PHYSICS = {
  GRAVITY_CONSTANT: 60,
  SOFTENING: 8,
  MAX_BODIES: 1000,
  MAX_DEPTH: 16,
  SEARCH_PADDING: 10,
  MAX_FRAGMENTS: 10,
  VAPORIZE_THRESHOLD: 100,
  MIN_GRAVITY_MASS: 5,
  DEBRIS_EXTRA_KICK: 5.0,
  MASS_RATIO_BIG: 4,
  ALPHA_MERGE: 0.25,
  FIXED_TIME_STEP: 1 / 60,
  DENSITY_2D: 0.5 * Math.PI,
  TRAIL_LENGTH: 1000,
  TRAIL_INTERVAL: 2,
  MIN_TRAIL_DISTANCE_SQ: 16,
  EARTH_RADIUS_UNITS: 30,
};

export function massFromRadius(radius) {
  return PHYSICS.DENSITY_2D * radius * radius;
}

export function radiusFromMass(mass) {
  return Math.sqrt(mass / PHYSICS.DENSITY_2D);
}
