/**
 * Fixed-capacity ring buffer of 2D points, backed by a single Float32Array.
 *
 * Replaces the previous `Array<{x, y}>` + `shift()` approach, which allocated two
 * objects per recorded point (up to 500k live objects at MAX_BODIES) and paid an
 * O(capacity) memmove on every push once the trail was full.
 *
 * Points are addressed in chronological order: index 0 is the oldest surviving
 * point, index `length - 1` is the newest.
 */
export class Trail {
  constructor(capacity) {
    this.capacity = Math.max(2, capacity | 0);
    this.points = new Float32Array(this.capacity * 2);

    /** Number of points currently stored (<= capacity). */
    this.count = 0;
    /** Slot the next point will be written to. */
    this.head = 0;

    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }

  get length() {
    return this.count;
  }

  /**
   * Chronological index -> physical slot in the ring buffer.
   * When not yet full, head === count, so this reduces to the identity.
   */
  _slot(i) {
    return (this.head - this.count + i + this.capacity) % this.capacity;
  }

  getX(i) {
    return this.points[this._slot(i) * 2];
  }

  getY(i) {
    return this.points[this._slot(i) * 2 + 1];
  }

  lastX() {
    return this.points[((this.head - 1 + this.capacity) % this.capacity) * 2];
  }

  lastY() {
    return this.points[((this.head - 1 + this.capacity) % this.capacity) * 2 + 1];
  }

  push(x, y) {
    const slot = this.head * 2;
    this.points[slot] = x;
    this.points[slot + 1] = y;

    // Read the values back so the bounds track the Float32-rounded coordinates that
    // getX/getY actually return; using the float64 inputs here can leave a stored
    // point a fraction outside its own bounding box.
    const sx = this.points[slot];
    const sy = this.points[slot + 1];

    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;

    if (sx < this.minX) this.minX = sx;
    if (sy < this.minY) this.minY = sy;
    if (sx > this.maxX) this.maxX = sx;
    if (sy > this.maxY) this.maxY = sy;

    // Evicted points can only ever have made the box too large, never too small.
    // Recomputing once per full lap keeps it tight at O(1) amortized cost.
    if (this.head === 0) this._recomputeBounds();
  }

  _recomputeBounds() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;

    const n = this.count;
    for (let i = 0; i < n; i++) {
      const slot = this._slot(i) * 2;
      const x = this.points[slot];
      const y = this.points[slot + 1];
      if (x < this.minX) this.minX = x;
      if (y < this.minY) this.minY = y;
      if (x > this.maxX) this.maxX = x;
      if (y > this.maxY) this.maxY = y;
    }
  }

  /**
   * Conservative overlap test against an axis-aligned view rectangle.
   * The stored box may over-approximate, so this can return true for an
   * off-screen trail, but never false for a visible one.
   */
  intersectsRect(left, top, right, bottom) {
    if (this.count === 0) return false;
    return this.maxX >= left && this.minX <= right && this.maxY >= top && this.minY <= bottom;
  }

  clear() {
    this.count = 0;
    this.head = 0;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }
}
