import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius, GRAVITY_CONSTANT } from '../core/config.js';

export function seedAsteroidRing(renderer) {
  const simulation = renderer?.simulation;
  const canvas = renderer?.canvas;
  if (!simulation || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  simulation.clear();

  // Central planet
  const PLANET_RADIUS = 50;
  const PLANET_MASS = massFromRadius(PLANET_RADIUS);

  const planet = new Body({
    position: new Vec2(cx, cy),
    velocity: new Vec2(0, 0),
    mass: PLANET_MASS,
    radius: PLANET_RADIUS,
  });

  simulation.addBody(planet);

  // Asteroid ring
  const G = GRAVITY_CONSTANT;
  const INNER_RADIUS = PLANET_RADIUS * 15;
  const OUTER_RADIUS = PLANET_RADIUS * 40;
  const ASTEROID_COUNT = 140;

  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const t = i / ASTEROID_COUNT;
    const angle = 2 * Math.PI * t + (Math.random() - 0.5) * (Math.PI / ASTEROID_COUNT) * 4;

    const ringRadius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * (0.15 + 0.7 * Math.random());

    const x = cx + ringRadius * Math.cos(angle);
    const y = cy + ringRadius * Math.sin(angle);

    const dir = new Vec2((x - cx) / ringRadius, (y - cy) / ringRadius);

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
}
