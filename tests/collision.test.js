import { describe, it, expect } from 'vitest';
import { CollisionResolver } from '../src/engine/systems/CollisionResolver.js';
import { PHYSICS } from '../src/shared/config/PhysicsConfig.js';
import { makeBody, totalMass } from './helpers.js';

function makeResolver(time = 0) {
  return new CollisionResolver({
    G: PHYSICS.GRAVITY_CONSTANT,
    softening: PHYSICS.SOFTENING,
    getTime: () => time,
  });
}

describe('CollisionResolver merging', () => {
  it('conserves mass and momentum when merging', () => {
    const resolver = makeResolver();
    const a = makeBody({ x: 0, y: 0, vx: 0.01, vy: 0, mass: 5000, radius: 30 });
    const b = makeBody({ x: 40, y: 0, vx: -0.01, vy: 0, mass: 3000, radius: 25 });

    const outcome = resolver.computeOutcome(a, b);

    expect(outcome).toHaveLength(1);
    const merged = outcome[0];
    expect(merged.mass).toBeCloseTo(a.mass + b.mass, 8);

    const pxBefore = a.mass * a.velocity.x + b.mass * b.velocity.x;
    expect(merged.mass * merged.velocity.x).toBeCloseTo(pxBefore, 6);
  });

  it('merges outright when the mass ratio is extreme', () => {
    const resolver = makeResolver();
    const star = makeBody({ x: 0, y: 0, mass: 1e7, radius: 100 });
    const speck = makeBody({ x: 100, y: 0, vx: -500, mass: 1, radius: 1 });

    const outcome = resolver.computeOutcome(star, speck);

    expect(outcome).toHaveLength(1);
    expect(outcome[0].mass).toBeCloseTo(star.mass + speck.mass, 6);
  });

  it('handles perfectly coincident bodies without producing NaN', () => {
    const resolver = makeResolver();
    const a = makeBody({ x: 0, y: 0, vx: 50, mass: 2000, radius: 20 });
    const b = makeBody({ x: 0, y: 0, vx: -50, mass: 2000, radius: 20 });

    const outcome = resolver.computeOutcome(a, b);

    for (const body of outcome) {
      expect(Number.isFinite(body.mass)).toBe(true);
      expect(Number.isFinite(body.position.x)).toBe(true);
      expect(Number.isFinite(body.position.y)).toBe(true);
      expect(Number.isFinite(body.velocity.x)).toBe(true);
      expect(Number.isFinite(body.velocity.y)).toBe(true);
    }
  });

  it('returns an empty outcome for zero total mass', () => {
    const resolver = makeResolver();
    expect(
      resolver.computeOutcome(makeBody({ mass: 0, radius: 1 }), makeBody({ mass: 0, radius: 1 }))
    ).toEqual([]);
  });
});

describe('CollisionResolver fragmentation', () => {
  it('scales destruction with impact energy instead of always shattering 80%', () => {
    // Regression test: `Math.max(0.8, destructionFactor)` pinned the fragmenting mass at
    // >= 80% of the small body for every impact, however gentle, making the whole
    // alpha ramp dead code.
    // Both speeds must clear ALPHA_MERGE * vEsc (~131 here), or the pair simply merges
    // and no fragments are produced at all.
    const grazing = fragmentedFraction(200);
    const violent = fragmentedFraction(900);

    expect(grazing).toBeLessThan(0.8);
    expect(violent).toBeGreaterThan(grazing);
    expect(violent).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it('gives fragments a cooldown so they cannot re-collide immediately', () => {
    const time = 5;
    const resolver = makeResolver(time);
    const big = makeBody({ x: 0, y: 0, mass: 200000, radius: 80 });
    const small = makeBody({ x: 85, y: 0, vx: -400, mass: 2000, radius: 12 });

    const outcome = resolver.computeOutcome(big, small);

    expect(outcome.length).toBeGreaterThan(1);
    for (const body of outcome) {
      expect(body.collisionCooldown).toBeCloseTo(time + PHYSICS.COLLISION_COOLDOWN, 10);
    }
  });

  it('gives every fragment a shape and a rotation', () => {
    const resolver = makeResolver();
    const big = makeBody({ x: 0, y: 0, mass: 200000, radius: 80 });
    const small = makeBody({ x: 85, y: 0, vx: -400, mass: 2000, radius: 12 });

    const fragments = resolver.computeOutcome(big, small).filter((b) => b.isDebris);

    expect(fragments.length).toBeGreaterThan(0);
    for (const frag of fragments) {
      expect(frag.shape).toBeTruthy();
      expect(frag.angle).toBeGreaterThanOrEqual(0);
      expect(frag.angle).toBeLessThan(Math.PI * 2 + 1e-9);
    }
  });

  it('never creates mass', () => {
    const resolver = makeResolver();
    const a = makeBody({ x: 0, y: 0, vx: 120, mass: 6000, radius: 40 });
    const b = makeBody({ x: 70, y: 0, vx: -120, mass: 5000, radius: 38 });

    const before = a.mass + b.mass;
    const outcome = resolver.computeOutcome(a, b);

    expect(totalMass(outcome)).toBeLessThanOrEqual(before + 1e-9);
  });
});

/**
 * Fraction of the smaller body's mass converted into fragments for a given impact speed.
 */
function fragmentedFraction(speed) {
  const resolver = makeResolver();
  const big = makeBody({ x: 0, y: 0, mass: 200000, radius: 80 });
  const small = makeBody({ x: 85, y: 0, vx: -speed, mass: 2000, radius: 12 });

  const outcome = resolver.computeOutcome(big, small);
  const fragmentMass = outcome.filter((b) => b.isDebris).reduce((sum, b) => sum + b.mass, 0);

  return fragmentMass / small.mass;
}
