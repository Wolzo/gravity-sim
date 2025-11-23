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
    const bodies = this.bodies;
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      bodies[i].resetAcceleration();
    }

    const G = this.G;
    const soft2 = this.softening * this.softening;

    for (let i = 0; i < n; i++) {
      const bi = bodies[i];
      const pi = bi.position;
      const ai = bi.acceleration;
      const mi = bi.mass;

      const pix = pi.x;
      const piy = pi.y;

      for (let j = i + 1; j < n; j++) {
        const bj = bodies[j];
        const pj = bj.position;
        const aj = bj.acceleration;
        const mj = bj.mass;

        const dx = pj.x - pix;
        const dy = pj.y - piy;

        const dist2 = dx * dx + dy * dy + soft2;

        const inv = 1 / Math.sqrt(dist2);
        const inv3 = inv * inv * inv;

        const s_i = G * mj * inv3;
        const s_j = G * mi * inv3;

        ai.x += dx * s_i;
        ai.y += dy * s_i;

        aj.x -= dx * s_j;
        aj.y -= dy * s_j;
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
