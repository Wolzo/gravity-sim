import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius, GRAVITY_CONSTANT } from '../core/config.js';
import { configureCameraForSeed } from '../utils/utils.js';

/**
 * Three-body "chaotic" system:
 * - three equal-mass bodies arranged on a triangle around the origin
 * - initial velocities approximating a rotating three-body ring
 * - plus a swarm of small bodies near the center.
 *
 * Everything is now expressed in world coordinates around (0, 0)
 */
export function seedTripleChaos(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const G = typeof simulation.G === 'number' ? simulation.G : GRAVITY_CONSTANT;

  const R = 180;
  const STAR_RADIUS = 20;
  const STAR_MASS = massFromRadius(STAR_RADIUS);

  // Positions of three stars at 0°, 120°, 240°
  const stars = [];
  for (let k = 0; k < 3; k++) {
    const angle = (2 * Math.PI * k) / 3;
    const x = R * Math.cos(angle);
    const y = R * Math.sin(angle);

    const pos = new Vec2(x, y);

    // Approximate velocity for a rotating three-body ring
    const dirToCenter = new Vec2(-x, -y);
    const distCenter = Math.hypot(dirToCenter.x, dirToCenter.y) || 1;
    dirToCenter.x /= distCenter;
    dirToCenter.y /= distCenter;
    const tangent = new Vec2(-dirToCenter.y, dirToCenter.x);

    const effectiveMass = 2 * STAR_MASS;
    const vCirc = Math.sqrt((G * effectiveMass) / (distCenter || 1));

    const jitter = 0.7 + 0.4 * Math.random();

    const vel = new Vec2(tangent.x * vCirc * jitter, tangent.y * vCirc * jitter);

    const star = new Body({
      position: pos,
      velocity: vel,
      mass: STAR_MASS,
      radius: STAR_RADIUS,
    });

    stars.push(star);
    simulation.addBody(star);
  }

  // Small planet swarm around the center to dare the chaos
  const SWARM_COUNT = 30;
  const INNER = 80;
  const OUTER = 260;

  for (let i = 0; i < SWARM_COUNT; i++) {
    const angle = 2 * Math.PI * (i / SWARM_COUNT) + Math.random() * 0.4;
    const radius = INNER + (OUTER - INNER) * Math.sqrt(Math.random());

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    const dirCenter = new Vec2(x, y);
    const dist = Math.hypot(dirCenter.x, dirCenter.y) || 1;
    dirCenter.x /= dist;
    dirCenter.y /= dist;

    const tangent = new Vec2(-dirCenter.y, dirCenter.x);

    const effectiveMass = 3 * STAR_MASS;
    const vCirc = Math.sqrt((G * effectiveMass) / (dist || 1));
    const base = 0.7 + 0.5 * Math.random();

    const vx = tangent.x * vCirc * base + (Math.random() - 0.5) * 10;
    const vy = tangent.y * vCirc * base + (Math.random() - 0.5) * 10;

    const bodyRadius = 3 + Math.random() * 2.5;
    const mass = massFromRadius(bodyRadius);

    const planet = new Body({
      position: new Vec2(x, y),
      velocity: new Vec2(vx, vy),
      mass,
      radius: bodyRadius,
    });

    simulation.addBody(planet);
  }

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 0.8,
  });
}
