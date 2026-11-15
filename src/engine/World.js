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

    /**
     * Mass annihilated rather than conserved: vaporized above VAPORIZE_THRESHOLD,
     * discarded as sub-pixel fragments, or dropped because MAX_BODIES was reached.
     * Surfaced in the HUD so these losses are visible instead of silent.
     */
    this.lostMass = 0;

    this.stepsSinceLastTrail = 0;
    this.fadingTrails = [];

    this.gravityTree = new QuadTree({ x: 0, y: 0, width: 1, height: 1 });
    this.collisionTree = new QuadTree({ x: 0, y: 0, width: 1, height: 1 });

    this.generatedBodiesBuffer = [];
    this.deadBodies = new Set();

    /** Set when bodies enter the world, so their a(t) is primed before integrating. */
    this.pendingAccelerationPrime = false;

    this.collisionResolver = new CollisionResolver({
      G: PHYSICS.GRAVITY_CONSTANT,
      softening: PHYSICS.SOFTENING,
      getTime: () => this.time,
    });

    this._initEvents();
  }

  _initEvents() {
    this.eventBus.on('world:add-body', (body) => this.addBody(body));
    this.eventBus.on('world:remove-body', (body) => this.removeBody(body));
    this.eventBus.on('world:request-info', ({ callback }) => callback({ bodies: this.bodies }));
    this.eventBus.on('world:clear', () => this.clear());
  }

  /**
   * Adds a body to the simulation if the limit has not been reached.
   */
  addBody(body) {
    if (this.bodies.length >= PHYSICS.MAX_BODIES) {
      this.lostMass += body.mass;
      return false;
    }

    this.bodies.push(body);
    body.accelerationValid = false;
    this.pendingAccelerationPrime = true;
    return true;
  }

  /**
   * Removes a body from the simulation.
   */
  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return false;

    this._retireTrail(body);
    this.bodies.splice(index, 1);
    return true;
  }

  /**
   * Hands a dead body's trail over to the fading-trail list so it dissolves
   * on screen instead of vanishing with the body.
   */
  _retireTrail(body) {
    if (body.trail && body.trail.length > 2) {
      this.fadingTrails.push({
        trail: body.trail,
        color: body.color,
        life: 1.0,
      });
    }
  }

  /**
   * Resets the entire simulation state.
   */
  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
    this.lostMass = 0;
    this.fadingTrails.length = 0;
    this.pendingAccelerationPrime = false;

    this.eventBus.emit('world:cleared', {
      collisionCount: this.collisionCount,
      lostMass: this.lostMass,
    });
  }

  /**
   * Advances the simulation by a fixed time step (dt).
   * Executes the full physics pipeline: Integration -> Spatial Update -> Gravity -> Collision.
   */
  step(dt) {
    if (dt <= 0) return;

    // Fading trails must decay even with an empty world, otherwise the ghosts of a
    // fully vaporized system stay on screen forever.
    this._decayFadingTrails(dt);

    if (this.bodies.length === 0) {
      this.time += dt;
      return;
    }

    if (this.pendingAccelerationPrime) {
      this._primeAccelerations();
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
      lostMass: this.lostMass,
    });
  }

  /**
   * Computes a(t) for bodies that just entered the world. Velocity Verlet assumes a
   * valid acceleration at the start of the step; without this, a new body's first
   * step degrades to explicit Euler and its trajectory starts off slightly wrong.
   */
  _primeAccelerations() {
    this._updateBoundsAndTrees();
    Dynamics.applyGravity(this.bodies, this.gravityTree);
    this.pendingAccelerationPrime = false;
  }

  _decayFadingTrails(dt) {
    for (let i = this.fadingTrails.length - 1; i >= 0; i--) {
      const trailObj = this.fadingTrails[i];
      trailObj.life -= dt * 0.5;
      if (trailObj.life <= 0) {
        this.fadingTrails.splice(i, 1);
      }
    }
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
    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    this.gravityTree.reset(bounds);
    this.collisionTree.reset(bounds);
  }

  /**
   * Detects and resolves collisions using the QuadTree for optimization.
   * Handles merging and fragmentation via CollisionResolver.
   */
  _resolveCollisions() {
    const bodies = this.bodies;
    const n = bodies.length;
    const time = this.time;

    for (let i = 0; i < n; i++) {
      this.collisionTree.insert(bodies[i]);
    }

    this.generatedBodiesBuffer.length = 0;
    const generatedBodies = this.generatedBodiesBuffer;

    const deadBodies = this.deadBodies;
    deadBodies.clear();

    const padding = PHYSICS.SEARCH_PADDING;

    for (let i = 0; i < n; i++) {
      const bi = bodies[i];

      if (deadBodies.has(bi)) continue;
      // Debris never initiates a collision, so debris-debris pairs are skipped by
      // construction; debris is still resolved when it appears as a neighbour below.
      if (bi.isDebris) continue;
      if (bi.collisionCooldown > time) continue;

      const searchRadius = bi.radius + padding;
      const neighbors = this.collisionTree.query(bi.position.x, bi.position.y, searchRadius);

      for (const bj of neighbors) {
        if (bi === bj || deadBodies.has(bj)) continue;

        // Fragments spawn overlapping their siblings and their parent's core. Without
        // this cooldown they re-collide on the very next step, cascading into runaway
        // fragmentation and mass loss.
        if (bj.collisionCooldown > time) continue;

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const rSum = bi.radius + bj.radius;
        const distSq = dx * dx + dy * dy;

        if (distSq < rSum * rSum) {
          const massBefore = bi.mass + bj.mass;
          let massAfter = 0;

          const outcome = this.collisionResolver.computeOutcome(bi, bj);

          if (Array.isArray(outcome)) {
            for (const nb of outcome) {
              if (nb && Number.isFinite(nb.mass) && nb.mass > 0 && nb.radius > 0.5) {
                generatedBodies.push(nb);
                massAfter += nb.mass;
              }
            }
          }

          this.lostMass += Math.max(0, massBefore - massAfter);

          deadBodies.add(bi);
          deadBodies.add(bj);
          this.collisionCount++;

          this.eventBus.emit('world:collision', {
            collisionCount: this.collisionCount,
            lostMass: this.lostMass,
            bodyA: bi,
            bodyB: bj,
          });

          break;
        }
      }
    }

    if (deadBodies.size === 0 && generatedBodies.length === 0) return;

    for (const body of deadBodies) {
      this._retireTrail(body);
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
        newBody.accelerationValid = false;
        this.pendingAccelerationPrime = true;
      } else {
        this.lostMass += newBody.mass;
      }
    }
  }

  /**
   * Total mass currently present in the simulation.
   */
  totalMass() {
    let sum = 0;
    for (const b of this.bodies) sum += b.mass;
    return sum;
  }

  /**
   * Total linear momentum. Drifts over time when MIN_GRAVITY_MASS > 0, since
   * sub-threshold bodies feel gravity without exerting it.
   */
  totalMomentum() {
    let px = 0;
    let py = 0;
    for (const b of this.bodies) {
      px += b.mass * b.velocity.x;
      py += b.mass * b.velocity.y;
    }
    return { x: px, y: py };
  }

  totalKineticEnergy() {
    let sum = 0;
    for (const b of this.bodies) sum += b.kineticEnergy();
    return sum;
  }
}
