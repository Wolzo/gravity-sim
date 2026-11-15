import { describe, it, expect } from 'vitest';
import { QuadTree } from '../src/engine/systems/QuadTree.js';
import { PHYSICS } from '../src/shared/config/PhysicsConfig.js';
import { makeBody, bruteForceAccelerations, boundsOf, mulberry32 } from './helpers.js';

const G = PHYSICS.GRAVITY_CONSTANT;
const SOFTENING = PHYSICS.SOFTENING;

function buildTree(bodies, theta) {
  const tree = new QuadTree(boundsOf(bodies), theta);
  for (const b of bodies) {
    if (b.mass > PHYSICS.MIN_GRAVITY_MASS) tree.insert(b);
  }
  return tree;
}

function accelerate(bodies, tree) {
  for (const b of bodies) {
    b.resetAcceleration();
    tree.accumulateAcceleration(b, G, SOFTENING);
  }
}

describe('QuadTree gravity', () => {
  it('never lets a body attract itself', () => {
    const body = makeBody({ x: 12, y: -34, mass: 5000 });
    const tree = buildTree([body], PHYSICS.THETA);

    accelerate([body], tree);

    expect(body.acceleration.x).toBe(0);
    expect(body.acceleration.y).toBe(0);
  });

  it('matches brute force almost exactly at a tiny opening angle', () => {
    const random = mulberry32(1234);
    const bodies = [];
    for (let i = 0; i < 60; i++) {
      bodies.push(
        makeBody({
          x: random() * 4000 - 2000,
          y: random() * 4000 - 2000,
          mass: 50 + random() * 5000,
        })
      );
    }

    const expected = bruteForceAccelerations(bodies);
    accelerate(bodies, buildTree(bodies, 0.05));

    bodies.forEach((body, i) => {
      const { ax, ay } = expected[i];
      const scale = Math.hypot(ax, ay) || 1;
      expect(Math.abs(body.acceleration.x - ax) / scale).toBeLessThan(1e-3);
      expect(Math.abs(body.acceleration.y - ay) / scale).toBeLessThan(1e-3);
    });
  });

  it('stays within a few percent of brute force at the default opening angle', () => {
    const random = mulberry32(99);
    const bodies = [];
    for (let i = 0; i < 200; i++) {
      bodies.push(
        makeBody({
          x: random() * 10000 - 5000,
          y: random() * 10000 - 5000,
          mass: 100 + random() * 2000,
        })
      );
    }

    const expected = bruteForceAccelerations(bodies);
    accelerate(bodies, buildTree(bodies, PHYSICS.THETA));

    const errors = bodies.map((body, i) => {
      const { ax, ay } = expected[i];
      const scale = Math.hypot(ax, ay) || 1;
      return Math.hypot(body.acceleration.x - ax, body.acceleration.y - ay) / scale;
    });

    const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(mean).toBeLessThan(0.05);
  });

  it('clamps theta below the self-attraction threshold', () => {
    const tree = new QuadTree({ x: 0, y: 0, width: 10, height: 10 }, 5);
    expect(tree.theta).toBeLessThanOrEqual(PHYSICS.THETA_MAX);
  });
});

describe('QuadTree at MAX_DEPTH', () => {
  // Cells shrink to root_size / 2^MAX_DEPTH, so bodies this close share one leaf and
  // exercise the overflow path.
  const EPS = 1e-7;

  it('keeps coincident bodies discoverable by query', () => {
    const a = makeBody({ x: 0, y: 0, mass: 1000 });
    const b = makeBody({ x: EPS, y: EPS, mass: 1000 });
    const c = makeBody({ x: 2 * EPS, y: 0, mass: 1000 });

    const tree = buildTree([a, b, c], PHYSICS.THETA);
    const found = tree.query(0, 0, 1);

    expect(found).toContain(a);
    expect(found).toContain(b);
    expect(found).toContain(c);
  });

  it('does not let an overflowed body attract itself', () => {
    const a = makeBody({ x: 0, y: 0, mass: 1000 });
    const b = makeBody({ x: EPS, y: 0, mass: 1000 });

    const tree = buildTree([a, b], PHYSICS.THETA);
    accelerate([a, b], tree);

    // Equal masses at (effectively) the same point: each pulls the other with a force
    // that softening keeps finite, and the pair must be symmetric.
    expect(Number.isFinite(a.acceleration.x)).toBe(true);
    expect(Number.isFinite(b.acceleration.x)).toBe(true);
    expect(a.acceleration.x).toBeCloseTo(-b.acceleration.x, 10);
    expect(a.acceleration.y).toBeCloseTo(-b.acceleration.y, 10);
  });
});

describe('QuadTree query', () => {
  it('returns every body inside the radius', () => {
    const inside = [
      makeBody({ x: 0, y: 0 }),
      makeBody({ x: 30, y: 0 }),
      makeBody({ x: 0, y: -30 }),
    ];
    const outside = [makeBody({ x: 900, y: 900 })];
    const tree = buildTree([...inside, ...outside], PHYSICS.THETA);

    const found = tree.query(0, 0, 50);

    for (const body of inside) expect(found).toContain(body);
    for (const body of outside) expect(found).not.toContain(body);
  });

  it('reuses its result array across calls', () => {
    const bodies = [makeBody({ x: 0, y: 0 }), makeBody({ x: 500, y: 500 })];
    const tree = buildTree(bodies, PHYSICS.THETA);

    const first = tree.query(0, 0, 10);
    const second = tree.query(500, 500, 10);

    expect(second).toBe(first);
    expect(second).toHaveLength(1);
  });
});
