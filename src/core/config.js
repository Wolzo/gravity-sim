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
export const TRAIL_LENGTH = -1;

/**
 * Maximum time step allowed per frame for numerical stability.
 */
export const MAX_DT = 0.05;

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
