import { GRAVITY_CONSTANT, SOFTENING, TRAIL_LENGTH } from './config.js';

import { Vec2 } from './vector2.js';
import { Body } from './body.js';
import { radiusFromMass } from './config.js';

/**
 * Core N-body gravity simulation.
 * Holds bodies, applies gravity, integrates motion, and merges collisions.
 */
export class Simulation {
  constructor({ G = GRAVITY_CONSTANT, softening = SOFTENING } = {}) {
    this.G = G;
    this.softening = softening;
    this.bodies = [];
    this.time = 0;
    this.collisionCount = 0;
  }

  addBody(body) {
    this.bodies.push(body);
  }

  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return false;

    if (body.trail) body.trail.length = 0;
    if (this.followTarget === body) this.followTarget = null;

    this.bodies.splice(index, 1);
    return true;
  }

  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
  }

  /**
   * Advance the simulation by dt seconds:
   * - computes gravitational forces
   * - integrates motion
   * - resolves collisions
   * - updates the internal time accumulator.
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

  /**
   * Computes gravitational accelerations between all bodies in the system.
   * Applies Newton’s law of universal gravitation (F = G * m1 * m2 / r^2)
   * and updates each body’s acceleration accordingly.
   * Uses a small softening term to prevent numerical instabilities
   * when two bodies are very close to each other.
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
   * Integrates the equations of motion by updating each body's
   * velocity and position based on its current acceleration.
   * Implements a semi-implicit (symplectic) Euler integrator,
   * which provides better energy conservation for orbital systems.
   * Also records recent positions to generate a visible trail
   * for rendering orbital paths.
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
   * Detects and resolves collisions between bodies.
   * When two bodies overlap (distance < sum of radii),
   * they merge into a single body conserving total mass
   * and linear momentum.
   * The merged body is placed at the center of mass,
   * moves with the mass-weighted average velocity,
   * and has a radius based on the combined area of both bodies.
   */
  _resolveCollisions() {
    const n = this.bodies.length;
    const alive = new Array(n).fill(true);
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
        const minDist = bi.radius + bj.radius;

        if (dist < minDist) {
          const totalMass = bi.mass + bj.mass;

          const vx = (bi.velocity.x * bi.mass + bj.velocity.x * bj.mass) / totalMass;
          const vy = (bi.velocity.y * bi.mass + bj.velocity.y * bj.mass) / totalMass;

          const x = (bi.position.x * bi.mass + bj.position.x * bj.mass) / totalMass;
          const y = (bi.position.y * bi.mass + bj.position.y * bj.mass) / totalMass;

          const newRadius = radiusFromMass(totalMass);

          const dominant = bi.mass >= bj.mass ? bi : bj;
          const mergedBody = new Body({
            position: new Vec2(x, y),
            velocity: new Vec2(vx, vy),
            mass: totalMass,
            radius: newRadius,
            color: dominant.color,
            name: dominant.name,
          });

          mergedBody.trail = bi.trail.length > bj.trail.length ? [...bi.trail] : [...bj.trail];

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
