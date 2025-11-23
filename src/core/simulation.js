import { GRAVITY_CONSTANT, SOFTENING, TRAIL_LENGTH } from './config.js';
import { CollisionResolver } from './collisionResolver.js';
import { QuadTree } from './quadtree.js';

const MAX_BODIES = 400;
const THETA = 0.5; // Barnes-Hut opening angle threshold

/**
 * Core N-body gravity simulation.
 * Holds bodies, applies gravity, integrates motion, and delegates
 * collision handling to CollisionResolver.
 */
export class Simulation {
  constructor({ G = GRAVITY_CONSTANT, softening = SOFTENING } = {}) {
    this.G = G;
    this.softening = softening;
    this.bodies = [];
    this.time = 0;
    this.collisionCount = 0;

    this.debugEnabled = false;
    this.debugCollisions = [];
    this.maxDebugCollisions = 200;

    this.collisionResolver = new CollisionResolver({
      G: this.G,
      softening: this.softening,
      getTime: () => this.time,
      recordDebug: (info) => this._recordCollisionDebug(info),
    });
  }

  addBody(body) {
    if (this.bodies.length >= MAX_BODIES) {
      return false;
    }

    this.bodies.push(body);
    return true;
  }

  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return false;

    if (body.trail) body.trail.length = 0;

    this.bodies.splice(index, 1);
    return true;
  }

  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
    this.debugCollisions = [];
  }

  /**
   * Advance the simulation by dt seconds:
   * - compute gravitational forces
   * - integrate motion
   * - resolve collisions
   * - advance internal time
   */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    if (this.bodies.length === 0) {
      this.time += dt;
      return;
    }

    this._computeForces();
    this._integrate(dt);
    this._resolveCollisions();
    this.time += dt;
  }

  getBodyCount() {
    return this.bodies.length;
  }

  getTotalKineticEnergy() {
    return this.bodies.reduce((sum, b) => sum + b.kineticEnergy(), 0);
  }

  getSummary() {
    return {
      time: this.time,
      bodies: this.bodies.length,
      collisions: this.collisionCount,
      kineticEnergy: this.getTotalKineticEnergy(),
    };
  }

  enableCollisionDebug({ max = 200, reset = true } = {}) {
    this.debugEnabled = true;
    if (reset) {
      this.debugCollisions = [];
    }
    this.maxDebugCollisions = max | 0;
  }

  disableCollisionDebug() {
    this.debugEnabled = false;
  }

  clearCollisionDebugData() {
    this.debugCollisions = [];
  }

  getCollisionDebugSnapshot() {
    return this.debugCollisions.slice();
  }

  _recordCollisionDebug(info) {
    if (!this.debugEnabled) return;

    this.debugCollisions.push(info);
    if (this.debugCollisions.length > this.maxDebugCollisions) {
      this.debugCollisions.shift();
    }

    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[collision]', info);
    }
  }

  /**
   * Calculates gravitational forces using Barnes-Hut algorithm (O(N log N)).
   */
  _computeForces() {
    const bodies = this.bodies;
    const count = bodies.length;

    if (count === 0) return;

    // 1. Calculate world bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      b.resetAcceleration();

      if (b.position.x < minX) minX = b.position.x;
      if (b.position.y < minY) minY = b.position.y;
      if (b.position.x > maxX) maxX = b.position.x;
      if (b.position.y > maxY) maxY = b.position.y;
    }

    // Add padding to avoid edge cases
    const padding = 100;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: width,
      height: height,
    };

    // 2. Build QuadTree
    const tree = new QuadTree(bounds, THETA);
    for (let i = 0; i < count; i++) {
      tree.insert(bodies[i]);
    }

    // 3. Calculate forces
    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      const force = tree.calculateForce(b, this.G, this.softening);

      b.acceleration.x += force.x;
      b.acceleration.y += force.y;
    }
  }

  /**
   * Integrate motion with a semi-implicit (symplectic) Euler step
   * and update trails for rendering.
   */
  _integrate(dt) {
    for (const body of this.bodies) {
      body.velocity.x += body.acceleration.x * dt;
      body.velocity.y += body.acceleration.y * dt;

      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;

      body.trail.push({
        x: body.position.x,
        y: body.position.y,
      });

      if (TRAIL_LENGTH !== -1 && body.trail.length > TRAIL_LENGTH) {
        body.trail.shift();
      }
    }
  }

  /**
   * Detect and resolve collisions.
   * For each overlapping pair, we remove both bodies and replace them
   * with zero or more new bodies produced by the CollisionResolver.
   */
  _resolveCollisions() {
    const bodies = this.bodies;
    const n = bodies.length;
    const alive = new Array(n).fill(true);
    const generatedBodies = [];

    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;

      const bi = bodies[i];
      const pix = bi.position.x;
      const piy = bi.position.y;
      const ri = bi.radius;

      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;

        const bj = bodies[j];
        const pjx = bj.position.x;
        const pjy = bj.position.y;
        const rj = bj.radius;

        const dx = pjx - pix;
        const dy = pjy - piy;
        const rSum = ri + rj;
        const d2 = dx * dx + dy * dy;

        if (d2 < rSum * rSum) {
          const outcome = this.collisionResolver.computeOutcome(bi, bj);

          if (Array.isArray(outcome)) {
            for (let k = 0; k < outcome.length; k++) {
              const nb = outcome[k];

              if (!nb) continue;
              if (!Number.isFinite(nb.mass) || nb.mass <= 0) continue;
              if (!Number.isFinite(nb.radius) || nb.radius <= 0.5) continue;

              generatedBodies.push(nb);
            }
          }

          alive[i] = false;
          alive[j] = false;
          this.collisionCount++;
          break;
        }
      }
    }

    const result = [];
    for (let i = 0; i < n; i++) {
      if (alive[i]) result.push(bodies[i]);
    }

    for (let k = 0; k < generatedBodies.length; k++) {
      if (result.length >= MAX_BODIES) break;
      result.push(generatedBodies[k]);
    }

    this.bodies = result;
  }
}
