import { Body } from '../src/engine/Body.js';
import { Vec2 } from '../src/shared/math/Vec2.js';
import { PHYSICS } from '../src/shared/config/PhysicsConfig.js';

/**
 * Creates a body with an explicit radius, so tests can place masses close together
 * without the collision pass firing.
 */
export function makeBody({ x = 0, y = 0, vx = 0, vy = 0, mass = 100, radius = 1 }) {
  return new Body({
    position: new Vec2(x, y),
    velocity: new Vec2(vx, vy),
    mass,
    radius,
    color: '#ffffff',
    name: 'test',
  });
}

/**
 * Exact O(N^2) acceleration, mirroring the tree's insertion rule so the two are
 * directly comparable.
 */
export function bruteForceAccelerations(
  bodies,
  G = PHYSICS.GRAVITY_CONSTANT,
  softening = PHYSICS.SOFTENING
) {
  const softSq = softening * softening;

  return bodies.map((body) => {
    let ax = 0;
    let ay = 0;

    for (const other of bodies) {
      if (other === body) continue;
      if (other.mass <= PHYSICS.MIN_GRAVITY_MASS) continue;

      const dx = other.position.x - body.position.x;
      const dy = other.position.y - body.position.y;
      const soft = dx * dx + dy * dy + softSq;
      const factor = (G * other.mass) / (soft * Math.sqrt(soft));

      ax += dx * factor;
      ay += dy * factor;
    }

    return { ax, ay };
  });
}

export function boundsOf(bodies, padding = PHYSICS.SEARCH_PADDING) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of bodies) {
    minX = Math.min(minX, b.position.x);
    minY = Math.min(minY, b.position.y);
    maxX = Math.max(maxX, b.position.x);
    maxY = Math.max(maxY, b.position.y);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function totalMomentum(bodies) {
  let x = 0;
  let y = 0;
  for (const b of bodies) {
    x += b.mass * b.velocity.x;
    y += b.mass * b.velocity.y;
  }
  return { x, y };
}

export function totalMass(bodies) {
  return bodies.reduce((sum, b) => sum + b.mass, 0);
}

/** Deterministic PRNG, so a failing test always fails the same way. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
