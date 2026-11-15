import { describe, it, expect } from 'vitest';
import { Dynamics } from '../src/engine/systems/Dynamics.js';
import { QuadTree } from '../src/engine/systems/QuadTree.js';
import { PHYSICS } from '../src/shared/config/PhysicsConfig.js';
import { makeBody, boundsOf, totalMomentum } from './helpers.js';

const DT = PHYSICS.FIXED_TIME_STEP;

/**
 * Runs the same pipeline as World.step, minus collisions, so integration invariants
 * can be checked in isolation.
 */
function advance(bodies, steps, tree) {
  // Prime a(t): Velocity Verlet is only second-order accurate if the first step
  // already has a valid acceleration.
  tree.reset(boundsOf(bodies));
  Dynamics.applyGravity(bodies, tree);

  for (let i = 0; i < steps; i++) {
    Dynamics.integratePosition(bodies, DT, false);
    tree.reset(boundsOf(bodies));
    Dynamics.applyGravity(bodies, tree);
    Dynamics.integrateVelocity(bodies, DT);
  }
}

describe('Velocity Verlet integration', () => {
  it('conserves linear momentum for an isolated pair', () => {
    // With two bodies the Barnes-Hut traversal always resolves down to exact leaves,
    // so the forces are strictly equal and opposite.
    const bodies = [
      makeBody({ x: -400, y: 0, vy: 12, mass: 2000 }),
      makeBody({ x: 400, y: 0, vy: -6, mass: 4000 }),
    ];

    const before = totalMomentum(bodies);
    const tree = new QuadTree(boundsOf(bodies));
    advance(bodies, 2000, tree);
    const after = totalMomentum(bodies);

    const scale = Math.hypot(before.x, before.y) || 1;
    expect(Math.abs(after.x - before.x) / scale).toBeLessThan(1e-9);
    expect(Math.abs(after.y - before.y) / scale).toBeLessThan(1e-9);
  });

  it('holds a circular orbit over a full period', () => {
    const CENTRAL_MASS = 1e6;
    const R = 1000;

    // Orbital speed for the *softened* potential the engine actually integrates:
    // a = G M r / (r^2 + s^2)^{3/2}, and v^2 / r = a.
    const softSq = PHYSICS.SOFTENING * PHYSICS.SOFTENING;
    const accel = (PHYSICS.GRAVITY_CONSTANT * CENTRAL_MASS * R) / Math.pow(R * R + softSq, 1.5);
    const v = Math.sqrt(accel * R);
    const period = (2 * Math.PI * R) / v;

    const star = makeBody({ x: 0, y: 0, mass: CENTRAL_MASS, radius: 10 });
    // Below MIN_GRAVITY_MASS, so it acts as a test particle and the star stays put.
    const planet = makeBody({ x: R, y: 0, vy: v, mass: 1, radius: 2 });

    const bodies = [star, planet];
    const tree = new QuadTree(boundsOf(bodies));
    advance(bodies, Math.round(period / DT), tree);

    const radius = Math.hypot(
      planet.position.x - star.position.x,
      planet.position.y - star.position.y
    );
    expect(Math.abs(radius - R) / R).toBeLessThan(0.005);

    // After one period it should be back near where it started.
    expect(planet.position.x).toBeGreaterThan(R * 0.98);
    expect(Math.abs(planet.position.y)).toBeLessThan(R * 0.05);

    expect(star.position.x).toBe(0);
    expect(star.position.y).toBe(0);
  });

  it('records trail points only past the distance threshold', () => {
    const body = makeBody({ x: 0, y: 0, vx: 1000, mass: 100 });
    const bodies = [body];
    const tree = new QuadTree(boundsOf(bodies));

    Dynamics.applyGravity(bodies, tree);
    Dynamics.integratePosition(bodies, DT, true);
    expect(body.trail.length).toBe(1);

    // A step far shorter than sqrt(MIN_TRAIL_DISTANCE_SQ) must not add a point.
    body.velocity.set(0.01, 0);
    Dynamics.integratePosition(bodies, DT, true);
    expect(body.trail.length).toBe(1);

    body.velocity.set(10000, 0);
    Dynamics.integratePosition(bodies, DT, true);
    expect(body.trail.length).toBe(2);
  });

  it('marks accelerations valid once gravity has been applied', () => {
    const body = makeBody({ x: 0, y: 0, mass: 1000 });
    expect(body.accelerationValid).toBe(false);

    const bodies = [body];
    Dynamics.applyGravity(bodies, new QuadTree(boundsOf(bodies)));

    expect(body.accelerationValid).toBe(true);
  });
});
