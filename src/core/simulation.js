import {
  GRAVITY_CONSTANT,
  SOFTENING,
  TRAIL_LENGTH,
  MAX_BODIES,
  SEARCH_PADDING,
  TRAIL_INTERVAL,
  MIN_TRAIL_DISTANCE_SQ,
} from './config.js';
import { CollisionResolver } from './collisionResolver.js';
import { QuadTree } from './quadtree.js';

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

    this.stepsSinceLastTrail = 0;

    this.debugEnabled = false;
    this.debugCollisions = [];
    this.maxDebugCollisions = 200;

    this.quadTree = new QuadTree({ x: 0, y: 0, width: 1, height: 1 });
    this.generatedBodiesBuffer = [];

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
   * Advance the simulation by dt seconds using Velocity Verlet:
   * 1. First Half: Update position and half-velocity
   * 2. Compute Forces: Calculate new acceleration based on new positions
   * 3. Second Half: Update velocity with new acceleration
   * 4. Resolve Collisions
   */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.bodies.length === 0) {
      this.time += dt;
      return;
    }

    this.stepsSinceLastTrail++;

    const tryUpdateTrail = this.stepsSinceLastTrail >= TRAIL_INTERVAL;
    if (tryUpdateTrail) {
      this.stepsSinceLastTrail = 0;
    }

    this._integratePosition(dt, tryUpdateTrail);
    this._computeForces();
    this._integrateVelocity(dt);
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

    const padding = 100;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: width,
      height: height,
    };

    this.quadTree.reset(bounds);
    for (let i = 0; i < count; i++) {
      this.quadTree.insert(bodies[i]);
    }

    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      const force = this.quadTree.calculateForce(b, this.G, this.softening);

      b.acceleration.x += force.x;
      b.acceleration.y += force.y;
    }
  }

  /**
   * Verlet Pass 1:
   * r(t+dt) = r(t) + v(t)dt + 0.5 * a(t) * dt^2
   * v(t+0.5dt) = v(t) + 0.5 * a(t) * dt
   */
  _integratePosition(dt, updateTrail) {
    const halfDt = dt * 0.5;
    const dtSqHalf = dt * dt * 0.5;

    for (const body of this.bodies) {
      const ax = body.acceleration.x;
      const ay = body.acceleration.y;

      body.position.x += body.velocity.x * dt + ax * dtSqHalf;
      body.position.y += body.velocity.y * dt + ay * dtSqHalf;

      body.velocity.x += ax * halfDt;
      body.velocity.y += ay * halfDt;

      if (updateTrail) {
        let shouldAdd = false;
        const trail = body.trail;

        if (trail.length === 0) {
          shouldAdd = true;
        } else {
          const last = trail[trail.length - 1];
          const dx = body.position.x - last.x;
          const dy = body.position.y - last.y;
          if (dx * dx + dy * dy > MIN_TRAIL_DISTANCE_SQ) {
            shouldAdd = true;
          }
        }

        if (shouldAdd) {
          trail.push({
            x: body.position.x,
            y: body.position.y,
          });

          if (TRAIL_LENGTH !== -1 && trail.length > TRAIL_LENGTH) {
            trail.shift();
          }
        }
      }
    }
  }

  /**
   * Verlet Pass 2:
   * v(t+dt) = v(t+0.5dt) + 0.5 * a(t+dt) * dt
   */
  _integrateVelocity(dt) {
    const halfDt = dt * 0.5;

    for (const body of this.bodies) {
      body.velocity.x += body.acceleration.x * halfDt;
      body.velocity.y += body.acceleration.y * halfDt;
    }
  }

  /**
   * Detect and resolve collisions using QuadTree for broad-phase.
   * Optimized with persistent buffers and in-place array compaction.
   */
  _resolveCollisions() {
    const bodies = this.bodies;
    const n = bodies.length;

    if (!this.quadTree) return;

    this.generatedBodiesBuffer.length = 0;
    const generatedBodies = this.generatedBodiesBuffer;

    const deadBodies = new Set();

    for (let i = 0; i < n; i++) {
      const bi = bodies[i];

      if (deadBodies.has(bi)) continue;

      const searchRadius = bi.radius + SEARCH_PADDING;
      const neighbors = this.quadTree.query(bi.position.x, bi.position.y, searchRadius);

      for (const bj of neighbors) {
        if (bi === bj || deadBodies.has(bj)) continue;

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const rSum = bi.radius + bj.radius;
        const d2 = dx * dx + dy * dy;

        if (d2 < rSum * rSum) {
          const outcome = this.collisionResolver.computeOutcome(bi, bj);

          if (Array.isArray(outcome)) {
            for (const nb of outcome) {
              if (nb && Number.isFinite(nb.mass) && nb.mass > 0 && nb.radius > 0.5) {
                generatedBodies.push(nb);
              }
            }
          }

          deadBodies.add(bi);
          deadBodies.add(bj);
          this.collisionCount++;

          break;
        }
      }
    }

    if (deadBodies.size > 0 || generatedBodies.length > 0) {
      let writeIdx = 0;

      for (let i = 0; i < n; i++) {
        if (!deadBodies.has(bodies[i])) {
          bodies[writeIdx++] = bodies[i];
        }
      }

      bodies.length = writeIdx;

      for (const newBody of generatedBodies) {
        if (bodies.length < MAX_BODIES) {
          bodies.push(newBody);
        }
      }
    }
  }
}
