import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius } from '../core/config.js';
import { configureCameraForSeed } from '../utils/utils.js';

/**
 * Two equal-mass bodies on a head-on collision with low relative speed.
 * Intended to test the low-energy, mostly inelastic merge regime.
 */
export function seedLowEnergyMerge(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const RADIUS = 14;
  const MASS = massFromRadius(RADIUS);
  const SEPARATION = 120;

  const speed = 1.0; // low relative speed

  simulation.addBody(
    new Body({
      position: new Vec2(-SEPARATION / 2, 0),
      velocity: new Vec2(speed, 0),
      mass: MASS,
      radius: RADIUS,
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(SEPARATION / 2, 0),
      velocity: new Vec2(-speed, 0),
      mass: MASS,
      radius: RADIUS,
    })
  );

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 1.2,
  });
}
