import { Vec2 } from '../../shared/math/Vec2.js';
import { PHYSICS } from '../../shared/config/PhysicsConfig.js';
import { clamp } from '../../shared/math/MathUtils.js';

class Node {
  constructor(x, y, size, depth) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = depth;

    this.mass = 0;
    this.centerOfMass = new Vec2(0, 0);

    this.body = null;
    /** Extra bodies that landed in this cell at MAX_DEPTH; null when unused. */
    this.overflow = null;
    this.children = null;
  }

  static pool = [];

  static pop(x, y, size, depth) {
    const node = this.pool.pop();
    if (node) {
      node.reset(x, y, size, depth);
      return node;
    }
    return new Node(x, y, size, depth);
  }

  static push(node) {
    node.reclaim();
  }

  reset(x, y, size, depth) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = depth;
    this.mass = 0;
    this.centerOfMass.set(0, 0);
    this.body = null;
    this.overflow = null;
    this.children = null;
  }

  /**
   * Recursively pushes this node and children back to the pool.
   */
  reclaim() {
    if (this.children) {
      for (const child of this.children) {
        child.reclaim();
      }
      this.children = null;
    }
    this.body = null;
    this.overflow = null;
    Node.pool.push(this);
  }

  insert(body) {
    const totalMass = this.mass + body.mass;
    const wx = (this.centerOfMass.x * this.mass + body.position.x * body.mass) / totalMass;
    const wy = (this.centerOfMass.y * this.mass + body.position.y * body.mass) / totalMass;

    this.mass = totalMass;
    this.centerOfMass.set(wx, wy);

    if (this.children) {
      this.children[this._getQuadrant(body)].insert(body);
      return;
    }

    if (!this.body) {
      this.body = body;
      return;
    }

    if (this.depth < PHYSICS.MAX_DEPTH) {
      this._subdivide();

      const oldBodyQuad = this._getQuadrant(this.body);
      this.children[oldBodyQuad].insert(this.body);
      this.body = null;

      const newBodyQuad = this._getQuadrant(body);
      this.children[newBodyQuad].insert(body);
      return;
    }

    // At MAX_DEPTH we can no longer subdivide. Keeping the body in an overflow list
    // (rather than dropping it, as an earlier version did) matters twice over: it
    // stays discoverable by query(), and gravity can subtract its own contribution
    // instead of letting it attract itself through this cell's center of mass.
    if (this.overflow) this.overflow.push(body);
    else this.overflow = [body];
  }

  _subdivide() {
    const half = this.size / 2;
    const nextDepth = this.depth + 1;

    this.children = [
      Node.pop(this.x, this.y, half, nextDepth),
      Node.pop(this.x + half, this.y, half, nextDepth),
      Node.pop(this.x, this.y + half, half, nextDepth),
      Node.pop(this.x + half, this.y + half, half, nextDepth),
    ];
  }

  _getQuadrant(body) {
    const midX = this.x + this.size / 2;
    const midY = this.y + this.size / 2;
    const right = body.position.x >= midX;
    const bottom = body.position.y >= midY;

    if (!right && !bottom) return 0;
    if (right && !bottom) return 1;
    if (!right && bottom) return 2;
    return 3;
  }

  /**
   * Recursively collects bodies whose cell overlaps the circular range into `found`.
   * range: { x, y, r } (center x, center y, radius)
   */
  query(range, found) {
    const rangeLeft = range.x - range.r;
    const rangeRight = range.x + range.r;
    const rangeTop = range.y - range.r;
    const rangeBottom = range.y + range.r;

    const nodeRight = this.x + this.size;
    const nodeBottom = this.y + this.size;

    if (
      rangeLeft > nodeRight ||
      rangeRight < this.x ||
      rangeTop > nodeBottom ||
      rangeBottom < this.y
    ) {
      return;
    }

    if (this.body) {
      found.push(this.body);
    }

    if (this.overflow) {
      for (let i = 0; i < this.overflow.length; i++) {
        found.push(this.overflow[i]);
      }
    }

    if (this.children) {
      this.children[0].query(range, found);
      this.children[1].query(range, found);
      this.children[2].query(range, found);
      this.children[3].query(range, found);
    }
  }
}

export class QuadTree {
  constructor(bounds, theta = PHYSICS.THETA) {
    this.setTheta(theta);
    this.root = null;
    this._queryResult = [];
    this.reset(bounds);
  }

  /**
   * Theta is clamped below 1/sqrt(2): above that a node containing the evaluated
   * body could satisfy the opening criterion, and the body would attract itself
   * through that node's center of mass.
   */
  setTheta(theta) {
    this.theta = clamp(theta, 0.05, PHYSICS.THETA_MAX);
    this.thetaSq = this.theta * this.theta;
  }

  reset(bounds) {
    if (this.root) {
      Node.push(this.root);
    }

    const size = Math.max(bounds.width, bounds.height, 1e-6);
    this.root = Node.pop(bounds.x, bounds.y, size, 0);
  }

  insert(body) {
    this.root.insert(body);
  }

  /**
   * Returns bodies within `radius` of (x, y).
   * The returned array is reused across calls — copy it if you need to retain it.
   */
  query(x, y, radius) {
    const found = this._queryResult;
    found.length = 0;
    this.root.query({ x, y, r: radius }, found);
    return found;
  }

  /**
   * Adds the gravitational acceleration exerted by the tree onto `body.acceleration`.
   * Writes in place rather than returning a vector: at MAX_BODIES the previous
   * version allocated ~60k throwaway Vec2 per second.
   */
  accumulateAcceleration(body, G, softening) {
    this._accumulate(this.root, body, G, softening);
  }

  _accumulate(node, body, G, softening) {
    if (node.mass === 0) return;

    if (node.children) {
      const dx = node.centerOfMass.x - body.position.x;
      const dy = node.centerOfMass.y - body.position.y;
      const distSq = dx * dx + dy * dy;

      // Opening criterion `size / dist < theta`, squared to avoid a sqrt per node.
      // When distSq is 0 the test fails and we descend, so there is no division by zero.
      if (node.size * node.size < this.thetaSq * distSq) {
        this._pull(body, node.mass, dx, dy, distSq, G, softening);
        return;
      }

      this._accumulate(node.children[0], body, G, softening);
      this._accumulate(node.children[1], body, G, softening);
      this._accumulate(node.children[2], body, G, softening);
      this._accumulate(node.children[3], body, G, softening);
      return;
    }

    // Leaf: sum the real bodies instead of the aggregate, so `body` is excluded exactly.
    if (node.body && node.body !== body) {
      this._pullToward(body, node.body, G, softening);
    }

    if (node.overflow) {
      for (let i = 0; i < node.overflow.length; i++) {
        const other = node.overflow[i];
        if (other !== body) this._pullToward(body, other, G, softening);
      }
    }
  }

  _pullToward(body, other, G, softening) {
    const dx = other.position.x - body.position.x;
    const dy = other.position.y - body.position.y;
    this._pull(body, other.mass, dx, dy, dx * dx + dy * dy, G, softening);
  }

  _pull(body, mass, dx, dy, distSq, G, softening) {
    const soft = distSq + softening * softening;
    const factor = (G * mass) / (soft * Math.sqrt(soft));

    body.acceleration.x += dx * factor;
    body.acceleration.y += dy * factor;
  }
}
