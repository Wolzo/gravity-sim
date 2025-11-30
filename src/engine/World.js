import { PHYSICS } from '../shared/config/PhysicsConfig.js';
import { CollisionResolver } from './systems/CollisionResolver.js';
import { QuadTree } from './systems/QuadTree.js';
import { Dynamics } from './systems/Dynamics.js';

export class World {
  /**
   * Initializes the physics world, spatial structures, and event listeners
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.bodies = [];
    this.time = 0;
    this.collisionCount = 0;

    this.stepsSinceLastTrail = 0;

    this.gravityTree = new QuadTree({ x: 0, y: 0, width: 1, height: 1 });
    this.collisionTree = new QuadTree({ x: 0, y: 0, width: 1, height: 1 });

    this.generatedBodiesBuffer = [];

    this.collisionResolver = new CollisionResolver({
      G: PHYSICS.GRAVITY_CONSTANT,
      softening: PHYSICS.SOFTENING,
      getTime: () => this.time,
      eventBus: this.eventBus,
    });

    this._initEvents();
  }

  _initEvents() {
    this.eventBus.on('world:add-body', (body) => this.addBody(body));
    this.eventBus.on('world:remove-body', (body) => this.removeBody(body));
    this.eventBus.on('world:request-info', ({ callback }) => callback({ bodies: this.bodies }));
  }

  /**
   * Adds a body to the simulation if the limit has not been reached.
   */
  addBody(body) {
    if (this.bodies.length >= PHYSICS.MAX_BODIES) {
      return false;
    }
    this.bodies.push(body);
    this.eventBus.emit('world:body-added', body);
    return true;
  }

  /**
   * Removes a body from the simulation.
   */
  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return false;

    this.eventBus.emit('world:body-removed', body);
    this.bodies.splice(index, 1);
    return true;
  }

  /**
   * Resets the entire simulation state.
   */
  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
    this.eventBus.emit('world:cleared', { collisionCount: this.collisionCount });
  }

  /**
   * Advances the simulation by a fixed time step (dt).
   * Executes the full physics pipeline: Integration -> Spatial Update -> Gravity -> Collision.
   */
  step(dt) {
    if (dt <= 0) return;
    if (this.bodies.length === 0) {
      this.time += dt;
      return;
    }

    this.stepsSinceLastTrail++;
    const updateTrail = this.stepsSinceLastTrail >= PHYSICS.TRAIL_INTERVAL;
    if (updateTrail) {
      this.stepsSinceLastTrail = 0;
    }

    Dynamics.integratePosition(this.bodies, dt, updateTrail);
    this._updateBoundsAndTrees();
    Dynamics.applyGravity(this.bodies, this.gravityTree);
    Dynamics.integrateVelocity(this.bodies, dt);
    this._resolveCollisions();

    this.time += dt;

    this.eventBus.emit('world:step', {
      time: this.time,
      bodyCount: this.bodies.length,
      collisionCount: this.collisionCount,
    });
  }

  /**
   * Recalculates the world bounds based on body positions and resets the QuadTrees.
   * Ensures broad-phase collision and gravity calculations cover all entities.
   */
  _updateBoundsAndTrees() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b = this.bodies[i];
      if (b.position.x < minX) minX = b.position.x;
      if (b.position.y < minY) minY = b.position.y;
      if (b.position.x > maxX) maxX = b.position.x;
      if (b.position.y > maxY) maxY = b.position.y;
    }

    const padding = PHYSICS.SEARCH_PADDING;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width,
      height,
    };

    this.gravityTree.reset(bounds);
    this.collisionTree.reset(bounds);
  }

  /**
   * Detects and resolves collisions using the QuadTree for optimization.
   * Handles elastic collisions, merging, and fragmentation via CollisionResolver.
   */
  _resolveCollisions() {
    const bodies = this.bodies;
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      this.collisionTree.insert(bodies[i]);
    }

    this.generatedBodiesBuffer.length = 0;
    const generatedBodies = this.generatedBodiesBuffer;
    const deadBodies = new Set();
    const padding = PHYSICS.SEARCH_PADDING;

    for (let i = 0; i < n; i++) {
      const bi = bodies[i];

      if (deadBodies.has(bi)) continue;
      if (bi.isDebris) continue;

      const searchRadius = bi.radius + padding;
      const neighbors = this.collisionTree.query(bi.position.x, bi.position.y, searchRadius);

      for (const bj of neighbors) {
        if (bi === bj || deadBodies.has(bj)) continue;
        if (bi.isDebris && bj.isDebris) continue;

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const rSum = bi.radius + bj.radius;
        const distSq = dx * dx + dy * dy;

        if (distSq < rSum * rSum) {
          const outcome = this.collisionResolver.computeOutcome(bi, bj);

          if (Array.isArray(outcome) && outcome.length > 0) {
            for (const nb of outcome) {
              generatedBodies.push(nb);
            }
          }

          deadBodies.add(bi);
          deadBodies.add(bj);
          this.collisionCount++;

          this.eventBus.emit('world:collision', {
            collisionCount: this.collisionCount,
            bodyA: bi,
            bodyB: bj,
          });

          break;
        }
      }
    }

    if (deadBodies.size > 0 || generatedBodies.length > 0) {
      for (const body of deadBodies) {
        this.eventBus.emit('world:body-removed', body);
      }

      let writeIdx = 0;
      for (let i = 0; i < n; i++) {
        if (!deadBodies.has(bodies[i])) {
          bodies[writeIdx++] = bodies[i];
        }
      }
      bodies.length = writeIdx;

      const max = PHYSICS.MAX_BODIES;
      for (const newBody of generatedBodies) {
        if (bodies.length < max) {
          bodies.push(newBody);
        }
      }
    }
  }

  /**
   * Returns a snapshot of simulation statistics.
   */
  getSummary() {
    return {
      time: this.time,
      bodies: this.bodies.length,
      collisions: this.collisionCount,
    };
  }
}
