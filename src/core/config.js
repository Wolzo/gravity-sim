/**
 * Physical / engine constants for the gravity simulation.
 * Units are arbitrary and tuned for nice on-screen behavior.
 */

export const GRAVITY_CONSTANT = 60; // default G
export const SOFTENING = 8;         // avoids singularities at r -> 0

/**
 * Max points per trail.
 * -1 = no limit (useful for debugging, but can grow unbounded).
 */
export const TRAIL_LENGTH = -1;

// Max time step used in the main loop for stability.
export const MAX_DT = 0.05;
