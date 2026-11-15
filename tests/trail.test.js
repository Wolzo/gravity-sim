import { describe, it, expect } from 'vitest';
import { Trail } from '../src/engine/Trail.js';

describe('Trail (ring buffer)', () => {
  it('reads back points in chronological order before wrapping', () => {
    const trail = new Trail(8);
    trail.push(1, 2);
    trail.push(3, 4);
    trail.push(5, 6);

    expect(trail.length).toBe(3);
    expect([trail.getX(0), trail.getY(0)]).toEqual([1, 2]);
    expect([trail.getX(2), trail.getY(2)]).toEqual([5, 6]);
    expect([trail.lastX(), trail.lastY()]).toEqual([5, 6]);
  });

  it('caps at capacity and drops the oldest points once wrapped', () => {
    const capacity = 4;
    const trail = new Trail(capacity);

    for (let i = 0; i < 10; i++) trail.push(i, -i);

    expect(trail.length).toBe(capacity);
    // Only the last 4 pushes survive: 6,7,8,9
    expect(trail.getX(0)).toBe(6);
    expect(trail.getX(3)).toBe(9);
    expect(trail.lastX()).toBe(9);
    expect(trail.getY(0)).toBe(-6);
  });

  it('stays chronologically ordered across many wraps', () => {
    const trail = new Trail(5);
    for (let i = 0; i < 103; i++) trail.push(i, i * 2);

    for (let i = 1; i < trail.length; i++) {
      expect(trail.getX(i)).toBeGreaterThan(trail.getX(i - 1));
    }
    expect(trail.lastX()).toBe(102);
  });

  it('keeps a bounding box that never excludes a stored point', () => {
    const trail = new Trail(16);
    const random = () => Math.random() * 200 - 100;

    for (let i = 0; i < 200; i++) trail.push(random(), random());

    for (let i = 0; i < trail.length; i++) {
      expect(trail.getX(i)).toBeGreaterThanOrEqual(trail.minX);
      expect(trail.getX(i)).toBeLessThanOrEqual(trail.maxX);
      expect(trail.getY(i)).toBeGreaterThanOrEqual(trail.minY);
      expect(trail.getY(i)).toBeLessThanOrEqual(trail.maxY);
    }
  });

  it('culls only trails that are genuinely outside the view rect', () => {
    const trail = new Trail(8);
    trail.push(10, 10);
    trail.push(20, 20);

    expect(trail.intersectsRect(0, 0, 100, 100)).toBe(true);
    expect(trail.intersectsRect(15, 15, 100, 100)).toBe(true);
    expect(trail.intersectsRect(50, 50, 100, 100)).toBe(false);
    expect(new Trail(8).intersectsRect(0, 0, 100, 100)).toBe(false);
  });

  it('clears back to an empty state', () => {
    const trail = new Trail(4);
    trail.push(1, 1);
    trail.clear();

    expect(trail.length).toBe(0);
    expect(trail.intersectsRect(-1e9, -1e9, 1e9, 1e9)).toBe(false);
  });
});
