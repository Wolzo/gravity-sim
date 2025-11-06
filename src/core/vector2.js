/**
 * Minimal mutable 2D vector used by the physics core.
 */
export class Vec2 {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * @returns {Vec2}
   */
  clone() {
    return new Vec2(this.x, this.y);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Vec2}
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * @param {{x:number, y:number}} v
   * @returns {Vec2}
   */
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  /**
   * @param {{x:number, y:number}} v
   * @returns {Vec2}
   */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * @param {{x:number, y:number}} v
   * @returns {Vec2}
   */
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * @param {number} s
   * @returns {Vec2}
   */
  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /**
   * @returns {number}
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * @returns {number}
   */
  length() {
    return Math.sqrt(this.lengthSq());
  }

  /**
   * @param {{x:number, y:number}} a
   * @param {{x:number, y:number}} b
   * @returns {Vec2}
   */
  static subtract(a, b) {
    return new Vec2(a.x - b.x, a.y - b.y);
  }
}
