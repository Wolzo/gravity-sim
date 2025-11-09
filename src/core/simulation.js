import { GRAVITY_CONSTANT, SOFTENING, TRAIL_LENGTH } from './config.js';
import { CollisionResolver } from './collisionResolver.js';

const MAX_BODIES = 400;

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

    // CollisionResolver is responsible for classifying and resolving
    // pair-wise collisions (merge, big–small, mutual fragmentation).
    this.collisionResolver = new CollisionResolver({
      G: this.G,
      softening: this.softening,
      getTime: () => this.time,
      recordDebug: (info) => this._recordCollisionDebug(info),
    });
  }

  // ---- Public API ---------------------------------------------------------

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

  // ---- Debug API ---------------------------------------------------------

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
    // Return a shallow copy to avoid external mutation
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

  // ---- Physics core ------------------------------------------------------

  /**
   * Compute gravitational accelerations between all bodies using
   * Newton's law of universal gravitation with a softening term.
   */
  _computeForces() {
    const n = this.bodies.length;

    for (let i = 0; i < n; i++) {
      this.bodies[i].resetAcceleration();
    }

    for (let i = 0; i < n; i++) {
      const bi = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        const bj = this.bodies[j];

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;

        const distSq = dx * dx + dy * dy + this.softening * this.softening;
        const dist = Math.sqrt(distSq);
        const invDist3 = 1.0 / (distSq * dist); // 1 / r^3

        const factor = this.G * invDist3;

        const ax = factor * dx;
        const ay = factor * dy;

        bi.acceleration.x += ax * bj.mass;
        bi.acceleration.y += ay * bj.mass;

        bj.acceleration.x -= ax * bi.mass;
        bj.acceleration.y -= ay * bi.mass;
      }
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

      // At the end of velocity update:
      const damping = 1 - 0.003 * dt;
      body.velocity.x *= damping;
      body.velocity.y *= damping;

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
    const n = this.bodies.length;
    const alive = new Array(n).fill(true);
    const generatedBodies = [];

    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const bi = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        const bj = this.bodies[j];

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = bi.radius + bj.radius;

        if (dist < minDist) {
          const outcome = this.collisionResolver.computeOutcome(bi, bj);

          if (Array.isArray(outcome)) {
            for (const nb of outcome) {
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
      if (alive[i]) result.push(this.bodies[i]);
    }

    for (const nb of generatedBodies) {
      if (result.length >= MAX_BODIES) break;
      result.push(nb);
    }

    this.bodies = result;
  }
}
