import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius } from '../core/config.js';
import { generateRandomName } from '../utils/names.js';
import { randomColor, configureCameraForSeed } from '../utils/utils.js';

/**
 * High-energy impact between a massive body and a much smaller projectile.
 * Intended to test the big–small collision handling and asymmetrical debris.
 */
export function seedBigSmallImpact(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const BIG_RADIUS = 22;
  const SMALL_RADIUS = 7;

  const BIG_MASS = massFromRadius(BIG_RADIUS);
  const SMALL_MASS = massFromRadius(SMALL_RADIUS);

  const IMPACT_DISTANCE = 260;
  const speed = 8.0;

  // Massive target at the origin, initially at rest
  simulation.addBody(
    new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(0, 0),
      mass: BIG_MASS,
      radius: BIG_RADIUS,
      color: '#ffaa00',
      name: generateRandomName(),
    })
  );

  // Smaller projectile incoming from the left
  simulation.addBody(
    new Body({
      position: new Vec2(-IMPACT_DISTANCE, 0),
      velocity: new Vec2(speed, 0),
      mass: SMALL_MASS,
      radius: SMALL_RADIUS,
      color: '#00ccff',
      name: generateRandomName(),
    })
  );

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 0.9,
  });
}
