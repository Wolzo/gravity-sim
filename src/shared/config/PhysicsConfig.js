export const PHYSICS = {
  GRAVITY_CONSTANT: 60,
  SOFTENING: 8,
  MAX_BODIES: 1000,
  MAX_DEPTH: 16,
  SEARCH_PADDING: 10,
  MAX_FRAGMENTS: 10,
  VAPORIZE_THRESHOLD: 100,

  /**
   * Bodies lighter than this are treated as test particles: they *feel* gravity
   * but are not inserted into the Barnes-Hut tree, so they do not *exert* it.
   * This is a deliberate performance trade-off (debris and asteroid belts are
   * numerous and individually negligible), but it breaks Newton's third law:
   * the total momentum of the system will slowly drift. Set to 0 for a fully
   * symmetric — and considerably slower — simulation.
   */
  MIN_GRAVITY_MASS: 5,

  /**
   * Barnes-Hut opening angle. A node is approximated by its center of mass when
   * `size / distance < THETA`. Lower is more accurate and slower.
   * MUST stay below 1/sqrt(2) (~0.707): above that threshold a node *containing*
   * the body being evaluated could pass the test, making the body attract itself.
   */
  THETA: 0.5,
  THETA_MAX: 0.7,

  DEBRIS_EXTRA_KICK: 5.0,
  MASS_RATIO_BIG: 4,
  ALPHA_MERGE: 0.25,

  /** Cooldown (in simulation seconds) during which fresh fragments cannot re-collide. */
  COLLISION_COOLDOWN: 0.5,

  FIXED_TIME_STEP: 1 / 60,

  /** Maximum physics steps per rendered frame. Caps the achievable time scale. */
  MAX_STEPS_PER_FRAME: 8,

  DENSITY_2D: 0.5 * Math.PI,
  TRAIL_LENGTH: 500,
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
