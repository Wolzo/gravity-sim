import {
  GRAVITY_CONSTANT,
  SOFTENING,
  TRAIL_LENGTH
} from "./config.js";

import { Vec2 } from "./vector2.js";
import { Body } from "./body.js";

/**
 * Core N-body gravity simulation.
 * Holds bodies, applies gravity, integrates motion, merges collisions.
 */
export class Simulation {
  /**
   * @param {Object} [options]
   * @param {number} [options.G]
   * @param {number} [options.softening]
   */
  constructor({ G = GRAVITY_CONSTANT, softening = SOFTENING } = {}) {
    /** @type {number} */
    this.G = G;

    /** @type {number} */
    this.softening = softening;

    /** @type {Body[]} */
    this.bodies = [];

    /** @type {number} */
    this.time = 0;

    /** @type {number} */
    this.collisionCount = 0;
  }

  /**
   * Add a body to the simulation (no cloning).
   * @param {Body} body
   */
  addBody(body) {
    this.bodies.push(body);
  }

  /**
   * Remove all bodies and reset time / counters.
   */
  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
  }

  /**
   * Advance the simulation by `dt` seconds.
   * @param {number} dt
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

  /**
   * @returns {number}
   */
  getBodyCount() {
    return this.bodies.length;
  }

  /**
   * @returns {number}
   */
  getTotalKineticEnergy() {
    return this.bodies.reduce(
      (sum, b) => sum + b.kineticEnergy(),
      0
    );
  }

  /**
   * Simple snapshot used for logging / HUD.
   * @returns {{time:number, bodies:number, collisions:number, kineticEnergy:number}}
   */
  getSummary() {
    return {
      time: this.time,
      bodies: this.bodies.length,
      collisions: this.collisionCount,
      kineticEnergy: this.getTotalKineticEnergy()
    };
  }

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

        const distSq =
          dx * dx + dy * dy + this.softening * this.softening;
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

  _integrate(dt) {
    for (const body of this.bodies) {
      body.velocity.x += body.acceleration.x * dt;
      body.velocity.y += body.acceleration.y * dt;

      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;

      body.trail.push({
        x: body.position.x,
        y: body.position.y
      });

      if (TRAIL_LENGTH !== -1 && body.trail.length > TRAIL_LENGTH) {
        body.trail.shift();
      }
    }
  }

  _resolveCollisions() {
    const n = this.bodies.length;
    const alive = new Array(n).fill(true);
    /** @type {Body[]} */
    const mergedBodies = [];

    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const bi = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        const bj = this.bodies[j];

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist < bi.radius + bj.radius) {
          const totalMass = bi.mass + bj.mass;

          const vx =
            (bi.velocity.x * bi.mass + bj.velocity.x * bj.mass) /
            totalMass;
          const vy =
            (bi.velocity.y * bi.mass + bj.velocity.y * bj.mass) /
            totalMass;

          const x =
            (bi.position.x * bi.mass +
              bj.position.x * bj.mass) /
            totalMass;
          const y =
            (bi.position.y * bi.mass +
              bj.position.y * bj.mass) /
            totalMass;

          const newRadius = Math.sqrt(
            bi.radius * bi.radius + bj.radius * bj.radius
          );

          const color = bi.mass >= bj.mass ? bi.color : bj.color;

          const mergedBody = new Body({
            position: new Vec2(x, y),
            velocity: new Vec2(vx, vy),
            mass: totalMass,
            radius: newRadius,
            color
          });

          mergedBody.trail =
            bi.trail.length > bj.trail.length
              ? [...bi.trail]
              : [...bj.trail];

          mergedBodies.push(mergedBody);

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
    for (const merged of mergedBodies) {
      result.push(merged);
    }

    this.bodies = result;
  }
}
