/**
 * Minimal mutable 2D vector used by the physics core.
 * Includes object pooling to reduce Garbage Collection pressure.
 */
export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  static subtract(a, b) {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  /**
   * Static pool for reusing vector instances
   */
  static pool = [];

  /**
   * Get a vector from the pool or create a new one.
   */
  static pop() {
    return this.pool.pop() || new Vec2();
  }

  /**
   * Return a vector to the pool.
   */
  static push(v) {
    if (v) this.pool.push(v);
  }
}
