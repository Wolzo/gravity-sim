import { Vec2 } from './vector2.js';

const MAX_DEPTH = 64;

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
      new Node(this.x, this.y, half, nextDepth),
      new Node(this.x + half, this.y, half, nextDepth),
      new Node(this.x, this.y + half, half, nextDepth),
      new Node(this.x + half, this.y + half, half, nextDepth),
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
}

export class QuadTree {
  constructor(bounds, theta = 0.5) {
    // Ensure the tree area is square
    const size = Math.max(bounds.width, bounds.height);
    this.root = new Node(bounds.x, bounds.y, size, 0);
    this.theta = theta;
  }

  insert(body) {
    this.root.insert(body);
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
