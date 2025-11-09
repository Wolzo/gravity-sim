import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius } from '../core/config.js';
import { generateRandomName } from '../utils/names.js';
import { randomColor, configureCameraForSeed } from '../utils/utils.js';

/**
 * Two equal-mass bodies on a high-speed head-on collision.
 * Intended to test the high-energy mutual fragmentation / explosion regime.
 */
export function seedHighEnergyExplosion(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const RADIUS = 14;
  const MASS = massFromRadius(RADIUS);
  const SEPARATION = 200;

  const speed = 6.0; // high relative speed

  simulation.addBody(
    new Body({
      position: new Vec2(-SEPARATION / 2, 0),
      velocity: new Vec2(speed, 0),
      mass: MASS,
      radius: RADIUS,
      color: randomColor(),
      name: generateRandomName(),
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(SEPARATION / 2, 0),
      velocity: new Vec2(-speed, 0),
      mass: MASS,
      radius: RADIUS,
      color: randomColor(),
      name: generateRandomName(),
    })
  );

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 1.0,
  });
}
