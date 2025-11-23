/**
 * Base gravitational constant used by the simulation (tuned for visual stability).
 */
export const GRAVITY_CONSTANT = 60;

/**
 * Softening length added to r^2 to avoid singularities and huge forces at very small distances.
 */
export const SOFTENING = 8;

/**
 * Max number of trail points stored per body.
 * -1 = unlimited (useful for debugging, but can grow unbounded in memory).
 */
export const TRAIL_LENGTH = 20000;

/**
 * Max bodies allowed in the simulation.
 */
export const MAX_BODIES = 1000;

/**
 * Max depth for QuadTree recursion.
 * 16 is enough for double-precision float coordinates in this scale.
 */
export const MAX_DEPTH = 16;

/**
 * Distance to search around a body for collisions (Broad-phase padding).
 */
export const SEARCH_PADDING = 500;

/**
 * Hard cap on debris fragments per collision to prevent CPU freeze.
 */
export const MAX_FRAGMENTS = 30;

/**
 * Multiplier for fragment ejection speed.
 * Higher = more explosive debris.
 */
export const DEBRIS_EXTRA_KICK = 5.0;

/**
 * Mass ratio threshold (e.g., 4 means 4:1).
 * Above this, a collision is treated as a "crater/absorption" event (Big vs Small).
 * Below this, it's a "catastrophic fragmentation" (Big vs Big).
 */
export const MASS_RATIO_BIG = 4;

/**
 * Threshold for normalized relative velocity (vRel / vEscape).
 * Below this value, bodies simply merge inelastically (sticky collisions).
 */
export const ALPHA_MERGE = 0.25;

/**
 * Save a trail point only every N physics steps.
 * 4 steps @ 120Hz = 30 samples per second.
 */
export const TRAIL_INTERVAL = 4;

/**
 * Minimum distance (in pixels) a body must move to generate a new trail point.
 * Prevents slow/stationary bodies from stacking thousands of points in one spot.
 */
export const MIN_TRAIL_DISTANCE_SQ = 4 * 4;

/**
 * Fixed physics step (120 Hz)
 */
export const FIXED_TIME_STEP = 1 / 120;

/**
 * Effective 2D "surface density" used for the mass–radius relationship.
 * The simulation assumes mass ∝ area (m ∝ r²), not volume.
 */
export const DENSITY_2D = 0.5 * Math.PI;

/**
 * Computes a body's mass from its radius assuming constant 2D density.
 */
export function massFromRadius(radius) {
  return DENSITY_2D * radius * radius;
}

/**
 * Computes a body's radius from its mass assuming constant 2D density.
 */
export function radiusFromMass(mass) {
  return Math.sqrt(mass / DENSITY_2D);
}

/**
 * Reference Earth-like body used to keep all seeds and
 * user-created bodies on a consistent physical scale.
 *
 * Radius is expressed in the same "canvas units" used everywhere.
 * Mass is computed from the same 2D density law.
 */
export const EARTH_RADIUS_UNITS = 30;
export const EARTH_MASS_UNITS = DENSITY_2D * EARTH_RADIUS_UNITS * EARTH_RADIUS_UNITS;
