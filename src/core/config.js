export const GRAVITY_CONSTANT = 60;     // default G
export const SOFTENING = 8;             // avoids singularities at r -> 0
export const TRAIL_LENGTH = -1;         // max points per trail. -1 = no limit (useful for debugging, but can grow unbounded).

export const MAX_DT = 0.05;             // max time step used in the main loop for stability.

export const DENSITY_2D = 0.5 * Math.PI;

export function massFromRadius(radius) {
    return DENSITY_2D * radius * radius;
}

export function radiusFromMass(mass) {
    return Math.sqrt(mass / DENSITY_2D);
}