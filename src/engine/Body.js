import { Vec2 } from '../shared/math/Vec2.js';
import { generateRandomName } from '../shared/utils/Names.js';
import { colorForBody } from '../shared/utils/Colors.js';
import { PHYSICS } from '../shared/config/PhysicsConfig.js';
import { Trail } from './Trail.js';

let nextId = 1;

export class Body {
  constructor({
    position = new Vec2(),
    velocity = new Vec2(),
    mass = 1,
    radius = 4,
    color = null,
    name = null,
  } = {}) {
    this.id = nextId++;

    this.position = position;
    this.velocity = velocity;
    this.mass = mass;
    this.radius = radius;

    this.color = color == null ? colorForBody({ mass, velocity }) : color;
    this.name = name == null ? generateRandomName() : name;

    this.acceleration = new Vec2(0, 0);

    /**
     * Velocity Verlet needs a valid a(t) at the start of a step. A freshly created
     * body has none, so the World primes it before its first integration; without
     * that priming the first step silently degrades to explicit Euler.
     */
    this.accelerationValid = false;

    this.trail = new Trail(PHYSICS.TRAIL_LENGTH);

    this.isDebris = false;
    this.shape = null;
    this.angle = 0;

    /** Simulation time until which this body is exempt from collisions. */
    this.collisionCooldown = 0;
  }

  /**
   * Resets the accumulated acceleration to zero for the next force computation step.
   */
  resetAcceleration() {
    this.acceleration.set(0, 0);
  }

  /**
   * Calculates current kinetic energy (0.5 * m * v^2).
   */
  kineticEnergy() {
    const v2 = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    return 0.5 * this.mass * v2;
  }

  speed() {
    return Math.hypot(this.velocity.x, this.velocity.y);
  }
}
