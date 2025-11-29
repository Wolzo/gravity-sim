import { Vec2 } from '../shared/math/Vec2.js';
import { generateRandomName } from '../shared/utils/Names.js';
import { colorForBody } from '../shared/utils/Colors.js';

export class Body {
  constructor({
    position = new Vec2(),
    velocity = new Vec2(),
    mass = 1,
    radius = 4,
    color = null,
    name = null,
  } = {}) {
    this.position = position;
    this.velocity = velocity;
    this.mass = mass;
    this.radius = radius;

    this.color = color == null ? colorForBody({ mass, velocity }) : color;
    this.name = name == null ? generateRandomName() : name;

    this.acceleration = new Vec2(0, 0);

    this.trail = [];

    this.isDebris = false;
    this.shape = null;
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
}
