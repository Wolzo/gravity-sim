import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius, GRAVITY_CONSTANT } from '../core/config.js';
import { generateRandomName } from '../utils/names.js';
import { randomColor, configureCameraForSeed } from '../utils/utils.js';

/**
 * Initializes a simple binary system:
 * - two equal-mass bodies placed symmetrically around the canvas center
 * - opposite velocities so they orbit their common center of mass.
 * Useful as a compact test seed for dynamics and collisions.
 */
export function seedBinarySystem(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const RADIUS = 12;
  const MASS = massFromRadius(RADIUS);

  const ORBIT_RADIUS = 100;

  const G = typeof simulation.G === 'number' ? simulation.G : GRAVITY_CONSTANT;

  // For two equal masses m at distance 2a, circular orbit around barycenter:
  // v^2 = G * m / (4a)
  const orbitalSpeed = Math.sqrt((G * MASS) / (4 * ORBIT_RADIUS));

  simulation.addBody(
    new Body({
      position: new Vec2(-ORBIT_RADIUS, 0),
      velocity: new Vec2(0, orbitalSpeed),
      mass: MASS,
      radius: RADIUS,
      color: randomColor(),
      name: generateRandomName(),
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(ORBIT_RADIUS, 0),
      velocity: new Vec2(0, -orbitalSpeed),
      mass: MASS,
      radius: RADIUS,
      color: randomColor(),
      name: generateRandomName(),
    })
  );

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 1,
  });
}
