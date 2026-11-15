import { describe, it, expect } from 'vitest';
import { World } from '../src/engine/World.js';
import { EventBus } from '../src/bridge/EventBus.js';
import { PHYSICS } from '../src/shared/config/PhysicsConfig.js';
import { makeBody, totalMass } from './helpers.js';

function makeWorld() {
  return new World(new EventBus());
}

describe('World bookkeeping', () => {
  it('primes accelerations before the first integration', () => {
    const world = makeWorld();
    world.addBody(makeBody({ x: 0, y: 0, mass: 100000, radius: 5 }));
    const probe = makeBody({ x: 500, y: 0, mass: 10, radius: 2 });
    world.addBody(probe);

    expect(world.pendingAccelerationPrime).toBe(true);

    world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.pendingAccelerationPrime).toBe(false);
    expect(probe.accelerationValid).toBe(true);
    // Pulled toward the central mass, i.e. in -x.
    expect(probe.acceleration.x).toBeLessThan(0);
  });

  it('counts mass dropped at the body cap as lost', () => {
    const world = makeWorld();
    for (let i = 0; i < PHYSICS.MAX_BODIES; i++) {
      world.addBody(makeBody({ x: i * 50, y: 0, mass: 10, radius: 1 }));
    }

    expect(world.addBody(makeBody({ mass: 777 }))).toBe(false);
    expect(world.lostMass).toBe(777);
  });

  it('decays fading trails even when the world is empty', () => {
    const world = makeWorld();
    const body = makeBody({ x: 0, y: 0, mass: 100 });
    for (let i = 0; i < 10; i++) body.trail.push(i * 10, 0);

    world.addBody(body);
    world.removeBody(body);

    expect(world.bodies).toHaveLength(0);
    expect(world.fadingTrails).toHaveLength(1);

    // With an empty world the step used to return before the decay loop, leaving the
    // ghost trail on screen forever.
    for (let i = 0; i < 300; i++) world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.fadingTrails).toHaveLength(0);
  });

  it('advances time with an empty world', () => {
    const world = makeWorld();
    world.step(0.5);
    expect(world.time).toBeCloseTo(0.5, 12);
  });

  it('resets every counter on clear', () => {
    const world = makeWorld();
    world.addBody(makeBody({ mass: 100 }));
    world.lostMass = 42;
    world.collisionCount = 7;
    world.time = 3;

    world.clear();

    expect(world.bodies).toHaveLength(0);
    expect(world.lostMass).toBe(0);
    expect(world.collisionCount).toBe(0);
    expect(world.time).toBe(0);
    expect(world.fadingTrails).toHaveLength(0);
  });
});

describe('Collision cooldown', () => {
  it('exempts freshly created fragments from immediate re-collision', () => {
    const world = makeWorld();

    const a = makeBody({ x: 0, y: 0, mass: 500, radius: 20 });
    const b = makeBody({ x: 10, y: 0, mass: 500, radius: 20 });
    a.collisionCooldown = 10;
    b.collisionCooldown = 10;

    world.addBody(a);
    world.addBody(b);

    // Deeply overlapping, but both are still within their cooldown window.
    world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.collisionCount).toBe(0);
    expect(world.bodies).toHaveLength(2);
  });

  it('resolves the collision once the cooldown has expired', () => {
    const world = makeWorld();

    world.addBody(makeBody({ x: 0, y: 0, mass: 500, radius: 20 }));
    world.addBody(makeBody({ x: 10, y: 0, mass: 500, radius: 20 }));

    world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.collisionCount).toBe(1);
  });

  it('does not cascade into runaway fragmentation', () => {
    const world = makeWorld();

    // A fast, near-equal-mass impact: the outcome is fragments spawned overlapping each
    // other. Without the cooldown check they re-collided every step and the body count
    // oscillated wildly while mass drained away.
    world.addBody(makeBody({ x: -60, y: 0, vx: 40, mass: 4000, radius: 40 }));
    world.addBody(makeBody({ x: 60, y: 0, vx: -40, mass: 4000, radius: 40 }));

    for (let i = 0; i < 120; i++) world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.bodies.length).toBeLessThan(PHYSICS.MAX_BODIES);
    expect(world.collisionCount).toBeLessThan(60);
    for (const body of world.bodies) {
      expect(Number.isFinite(body.position.x)).toBe(true);
      expect(Number.isFinite(body.velocity.x)).toBe(true);
      expect(body.mass).toBeGreaterThan(0);
    }
  });
});

describe('Mass accounting', () => {
  it('never reports negative loss and keeps mass + loss bounded by the initial total', () => {
    const world = makeWorld();

    world.addBody(makeBody({ x: -60, y: 0, vx: 30, mass: 3000, radius: 35 }));
    world.addBody(makeBody({ x: 60, y: 0, vx: -30, mass: 3000, radius: 35 }));
    const initial = totalMass(world.bodies);

    for (let i = 0; i < 200; i++) world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.lostMass).toBeGreaterThanOrEqual(0);
    // Collisions only ever destroy mass, never create it.
    expect(world.totalMass()).toBeLessThanOrEqual(initial + 1e-6);
    expect(world.totalMass() + world.lostMass).toBeCloseTo(initial, 4);
  });

  it('conserves mass and momentum exactly through a low-energy merge', () => {
    const world = makeWorld();

    // Slow, grazing contact: alpha stays below ALPHA_MERGE, so the pair merges.
    const a = makeBody({ x: 0, y: 0, vx: 0.01, mass: 5000, radius: 30 });
    const b = makeBody({ x: 50, y: 0, vx: -0.01, mass: 5000, radius: 30 });
    world.addBody(a);
    world.addBody(b);

    const massBefore = totalMass(world.bodies);
    const pBefore = world.totalMomentum();

    world.step(PHYSICS.FIXED_TIME_STEP);

    expect(world.collisionCount).toBe(1);
    expect(world.bodies).toHaveLength(1);
    expect(world.lostMass).toBe(0);
    expect(world.totalMass()).toBeCloseTo(massBefore, 8);

    const pAfter = world.totalMomentum();
    expect(pAfter.x).toBeCloseTo(pBefore.x, 6);
    expect(pAfter.y).toBeCloseTo(pBefore.y, 6);
  });
});
