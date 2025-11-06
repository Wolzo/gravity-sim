import { Vec2 } from "./vector2.js";

/**
 * Single body in the N-body simulation
 */
export class Body {
  /**
   * @param {Object} [options]
   * @param {Vec2}   [options.position]
   * @param {Vec2}   [options.velocity]
   * @param {number} [options.mass=1]
   * @param {number} [options.radius=4]
   * @param {string} [options.color="#ffffff"]
   */
  constructor({
    position = new Vec2(),
    velocity = new Vec2(),
    mass = 1,
    radius = 4,
    color = "#ffffff"
  } = {}) {
    this.position = position;
    this.velocity = velocity;
    this.mass = mass;
    this.radius = radius;
    this.color = color;

    this.acceleration = new Vec2(0, 0);

    /**
     * Past positions used for trails.
     * @type {{x:number, y:number}[]}
     */
    this.trail = [];
  }

  /**
   * Zero the current acceleration.
   */
  resetAcceleration() {
    this.acceleration.set(0, 0);
  }

  /**
   * Kinetic energy: 1/2 m v^2.
   * @returns {number}
   */
  kineticEnergy() {
    const v2 =
      this.velocity.x * this.velocity.x +
      this.velocity.y * this.velocity.y;
    return 0.5 * this.mass * v2;
  }
}
