import { Vec2 } from './vector2.js';
import { MAX_DEPTH } from './config.js';

class Node {
  constructor(x, y, size, depth) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = depth;

    this.mass = 0;
    this.centerOfMass = new Vec2(0, 0);

    this.body = null;
    this.children = null;
  }

  static pool = [];

  static warmup(count) {
    for (let i = 0; i < count; i++) {
      this.pool.push(new Node(0, 0, 0, 0));
    }
  }

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

  /**
   * Resets the node state for reuse.
   */
  reset(x, y, size, depth) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = depth;
    this.mass = 0;
    this.centerOfMass = new Vec2(0, 0);
    this.body = null;
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
    Node.pool.push(this);
  }

  insert(body) {
    const totalMass = this.mass + body.mass;
    const wx = (this.centerOfMass.x * this.mass + body.position.x * body.mass) / totalMass;
    const wy = (this.centerOfMass.y * this.mass + body.position.y * body.mass) / totalMass;

    this.mass = totalMass;
    this.centerOfMass.set(wx, wy);

    if (this.children) {
      const quadrant = this._getQuadrant(body);
      this.children[quadrant].insert(body);
      return;
    }

    if (!this.body) {
      this.body = body;
      return;
    }

    if (this.depth < MAX_DEPTH) {
      this._subdivide();

      const oldBodyQuad = this._getQuadrant(this.body);
      this.children[oldBodyQuad].insert(this.body);
      this.body = null;

      const newBodyQuad = this._getQuadrant(body);
      this.children[newBodyQuad].insert(body);
    }
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
   * Recursively finds bodies within the defined circular range.
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

    if (this.children) {
      this.children[0].query(range, found);
      this.children[1].query(range, found);
      this.children[2].query(range, found);
      this.children[3].query(range, found);
    }
  }
}

export class QuadTree {
  cconstructor(bounds, theta = 0.5) {
    this.theta = theta;
    this.root = null;
    this.reset(bounds);
  }

  static warmup(count) {
    Node.warmup(count);
  }

  /**
   * Clears the tree and resets bounds without allocating new memory.
   */
  reset(bounds) {
    if (this.root) {
      Node.push(this.root);
    }

    const size = Math.max(bounds.width, bounds.height);
    this.root = Node.pop(bounds.x, bounds.y, size, 0);
  }

  insert(body) {
    this.root.insert(body);
  }

  /**
   * Returns all bodies within the given radius of (x, y).
   */
  query(x, y, radius) {
    const found = [];
    const range = { x, y, r: radius };
    this.root.query(range, found);
    return found;
  }

  calculateForce(body, G, softening) {
    const force = new Vec2(0, 0);
    this._calculateForceRecursive(this.root, body, G, softening, force);
    return force;
  }

  _calculateForceRecursive(node, body, G, softening, forceAcc) {
    if (node.mass === 0 || node.body === body) return;

    const dx = node.centerOfMass.x - body.position.x;
    const dy = node.centerOfMass.y - body.position.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    const size = node.size;

    if (node.children && size / dist < this.theta) {
      this._applyGravity(G, softening, node.mass, dx, dy, distSq, dist, forceAcc);
    } else if (node.body) {
      this._applyGravity(G, softening, node.mass, dx, dy, distSq, dist, forceAcc);
    } else if (node.children) {
      for (const child of node.children) {
        this._calculateForceRecursive(child, body, G, softening, forceAcc);
      }
    }
  }

  _applyGravity(G, softening, mass, dx, dy, distSq, dist, forceAcc) {
    const softSq = softening * softening;
    const invDist3 = 1.0 / ((distSq + softSq) * Math.sqrt(distSq + softSq));
    const factor = G * mass * invDist3;

    forceAcc.x += dx * factor;
    forceAcc.y += dy * factor;
  }
}
