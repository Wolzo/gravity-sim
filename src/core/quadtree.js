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

    this.body = null; // Stores body if this is a leaf node
    this.children = null; // Stores 4 sub-nodes if this is an internal node
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
    // Return node and its children to the pool
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
    this.centerOfMass = new Vec2(0, 0); // Note: Allocates once per Node life
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
    // Update Center of Mass and Total Mass
    const totalMass = this.mass + body.mass;
    const wx = (this.centerOfMass.x * this.mass + body.position.x * body.mass) / totalMass;
    const wy = (this.centerOfMass.y * this.mass + body.position.y * body.mass) / totalMass;

    this.mass = totalMass;
    this.centerOfMass.set(wx, wy);

    // Case 1: Internal node -> Recurse to children
    if (this.children) {
      const quadrant = this._getQuadrant(body);
      this.children[quadrant].insert(body);
      return;
    }

    // Case 2: Empty leaf -> Store body
    if (!this.body) {
      this.body = body;
      return;
    }

    // Case 3: Occupied leaf -> Subdivide and re-insert both
    if (this.depth < MAX_DEPTH) {
      this._subdivide();

      // Move the existing body to a child
      const oldBodyQuad = this._getQuadrant(this.body);
      this.children[oldBodyQuad].insert(this.body);
      this.body = null;

      // Insert the new body
      const newBodyQuad = this._getQuadrant(body);
      this.children[newBodyQuad].insert(body);
    }
    // If MAX_DEPTH reached, we technically ignore spatial split but mass is already added.
  }

  _subdivide() {
    const half = this.size / 2;
    const nextDepth = this.depth + 1;

    // Create 4 children: NW, NE, SW, SE
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

    if (!right && !bottom) return 0; // NW
    if (right && !bottom) return 1; // NE
    if (!right && bottom) return 2; // SW
    return 3; // SE
  }

  /**
   * Recursively finds bodies within the defined circular range.
   * range: { x, y, r } (center x, center y, radius)
   */
  query(range, found) {
    // Check if the range intersects this node's bounds
    // Node bounds: [this.x, this.x + this.size]
    const rangeLeft = range.x - range.r;
    const rangeRight = range.x + range.r;
    const rangeTop = range.y - range.r;
    const rangeBottom = range.y + range.r;

    const nodeRight = this.x + this.size;
    const nodeBottom = this.y + this.size;

    // No intersection? Abort.
    if (
      rangeLeft > nodeRight ||
      rangeRight < this.x ||
      rangeTop > nodeBottom ||
      rangeBottom < this.y
    ) {
      return;
    }

    // If leaf node with a body, add it
    if (this.body) {
      found.push(this.body);
    }

    // Recurse into children
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
    // Initial setup
    this.reset(bounds);
  }

  /**
   * Clears the tree and resets bounds without allocating new memory.
   */
  reset(bounds) {
    // If root exists, recycle it and its children
    if (this.root) {
      Node.push(this.root);
    }

    const size = Math.max(bounds.width, bounds.height);
    // Get a fresh root from the pool
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
    // Skip empty nodes or the body itself
    if (node.mass === 0 || node.body === body) return;

    const dx = node.centerOfMass.x - body.position.x;
    const dy = node.centerOfMass.y - body.position.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Barnes-Hut criterion: s / d < theta
    const size = node.size;

    if (node.children && size / dist < this.theta) {
      // Node is far enough: treat as a single body
      this._applyGravity(G, softening, node.mass, dx, dy, distSq, dist, forceAcc);
    } else if (node.body) {
      // Leaf node: compute direct gravity
      this._applyGravity(G, softening, node.mass, dx, dy, distSq, dist, forceAcc);
    } else if (node.children) {
      // Node is too close: recurse into children
      for (const child of node.children) {
        this._calculateForceRecursive(child, body, G, softening, forceAcc);
      }
    }
  }

  _applyGravity(G, softening, mass, dx, dy, distSq, dist, forceAcc) {
    const softSq = softening * softening;
    // Gravity formula: F = G * m1 * m2 / r^2
    // Vector form: a = F/m1 = G * m2 * vec(r) / r^3
    const invDist3 = 1.0 / ((distSq + softSq) * Math.sqrt(distSq + softSq));
    const factor = G * mass * invDist3;

    forceAcc.x += dx * factor;
    forceAcc.y += dy * factor;
  }
}
