import { Vec2 } from './vector2.js';

export class Body {
  constructor({
    position = new Vec2(),
    velocity = new Vec2(),
    mass = 1,
    radius = 4,
    color = '#ffffff',
    name = null,
  } = {}) {
    this.position = position;
    this.velocity = velocity;
    this.mass = mass;
    this.radius = radius;
    this.color = color;
    this.name = name;
    this.acceleration = new Vec2(0, 0);
    this.trail = [];
  }

  /**
   * Sets the accumulated acceleration to zero for the next force computation step.
   * Must be called before computing gravitational forces.
   */
  resetAcceleration() {
    this.acceleration.set(0, 0);
  }

  /**
   * Kinetic energy: 1/2 m v^2.
   */
  kineticEnergy() {
    const v2 = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    return 0.5 * this.mass * v2;
  }
}
