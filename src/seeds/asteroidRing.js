import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius, GRAVITY_CONSTANT } from '../core/config.js';
import { configureCameraForSeed } from '../utils/utils.js';

/**
 * Planet-centered asteroid ring:
 * - massive planet at the origin
 * - wide ring of small bodies in (almost) circular orbits
 *
 * Uses the same world coordinates as the Solar System seed:
 * the origin (0, 0) is the natural center of the scene and the
 * camera is positioned via configureCameraForSeed.
 */
export function seedAsteroidRing(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  // Central planet
  const PLANET_RADIUS = 80;
  const PLANET_MASS = massFromRadius(PLANET_RADIUS);

  const planet = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(0, 0),
    mass: PLANET_MASS,
    radius: PLANET_RADIUS,
  });

  simulation.addBody(planet);

  const G = typeof simulation.G === 'number' ? simulation.G : GRAVITY_CONSTANT;
  const INNER_RADIUS = PLANET_RADIUS * 20;
  const OUTER_RADIUS = PLANET_RADIUS * 50;
  const ASTEROID_COUNT = 240;

  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const t = i / ASTEROID_COUNT;
    const angle = 2 * Math.PI * t + (Math.random() - 0.5) * (Math.PI / ASTEROID_COUNT) * 4;

    const ringRadius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * (0.15 + 0.7 * Math.random());

    const x = ringRadius * Math.cos(angle);
    const y = ringRadius * Math.sin(angle);

    const dir = new Vec2(x / ringRadius, y / ringRadius);
    const tangent = new Vec2(-dir.y, dir.x);

    // Approx circular orbital speed around the planet
    const vCirc = Math.sqrt((G * PLANET_MASS) / (ringRadius || 1)) * 1.1;
    const speedFactor = 0.8 + 0.4 * Math.random();

    const vx = tangent.x * vCirc * speedFactor + (Math.random() - 0.5) * 2;
    const vy = tangent.y * vCirc * speedFactor + (Math.random() - 0.5) * 2;

    const radius = 2 + Math.random() * 3;
    const mass = massFromRadius(radius);

    const asteroid = new Body({
      position: new Vec2(x, y),
      velocity: new Vec2(vx, vy),
      mass,
      radius,
    });

    simulation.addBody(asteroid);
  }

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 0.25,
  });
}
