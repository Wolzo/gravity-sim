import { GRAVITY_CONSTANT, SOFTENING, TRAIL_LENGTH, radiusFromMass } from './config.js';
import { Vec2 } from './vector2.js';
import { Body } from './body.js';

// Tuning constants for cinematic fragmentation
const DEBRIS_EXTRA_KICK = 3.0; // multiplier for fragment ejection speed
const MASS_RATIO_BIG = 3; // above this, treat collision as big–small
const ALPHA_MERGE = 0.4; // below this, always inelastic merge
const MAX_BODIES = 400; // safety cap on total bodies

/**
 * Core N-body gravity simulation.
 * Holds bodies, applies gravity, integrates motion, and handles collisions.
 */
export class Simulation {
  constructor({ G = GRAVITY_CONSTANT, softening = SOFTENING } = {}) {
    this.G = G;
    this.softening = softening;
    this.bodies = [];
    this.time = 0;
    this.collisionCount = 0;

    this.debugEnabled = false;
    this.debugCollisions = [];
    this.maxDebugCollisions = 200;
  }

  // ---- Public API ---------------------------------------------------------

  addBody(body) {
    if (this.bodies.length >= MAX_BODIES) {
      return false;
    }

    this.bodies.push(body);
    return true;
  }

  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return false;

    if (body.trail) body.trail.length = 0;

    this.bodies.splice(index, 1);
    return true;
  }

  clear() {
    this.bodies.length = 0;
    this.time = 0;
    this.collisionCount = 0;
    this.debugCollisions = [];
  }

  /**
   * Advance the simulation by dt seconds:
   * - compute gravitational forces
   * - integrate motion
   * - resolve collisions
   * - advance internal time
   */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    if (this.bodies.length === 0) {
      this.time += dt;
      return;
    }

    this._computeForces();
    this._integrate(dt);
    this._resolveCollisions();
    this.time += dt;
  }

  getBodyCount() {
    return this.bodies.length;
  }

  getTotalKineticEnergy() {
    return this.bodies.reduce((sum, b) => sum + b.kineticEnergy(), 0);
  }

  getSummary() {
    return {
      time: this.time,
      bodies: this.bodies.length,
      collisions: this.collisionCount,
      kineticEnergy: this.getTotalKineticEnergy(),
    };
  }

  // ---- Debug API ---------------------------------------------------------

  enableCollisionDebug({ max = 200, reset = true } = {}) {
    this.debugEnabled = true;
    if (reset) {
      this.debugCollisions = [];
    }
    this.maxDebugCollisions = max | 0;
  }

  disableCollisionDebug() {
    this.debugEnabled = false;
  }

  clearCollisionDebugData() {
    this.debugCollisions = [];
  }

  getCollisionDebugSnapshot() {
    // Return a shallow copy to avoid external mutation
    return this.debugCollisions.slice();
  }

  _recordCollisionDebug(info) {
    if (!this.debugEnabled) return;

    this.debugCollisions.push(info);
    if (this.debugCollisions.length > this.maxDebugCollisions) {
      this.debugCollisions.shift();
    }

    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[collision]', info);
    }
  }

  // ---- Physics core ------------------------------------------------------

  /**
   * Compute gravitational accelerations between all bodies using
   * Newton's law of universal gravitation with a softening term.
   */
  _computeForces() {
    const n = this.bodies.length;

    for (let i = 0; i < n; i++) {
      this.bodies[i].resetAcceleration();
    }

    for (let i = 0; i < n; i++) {
      const bi = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        const bj = this.bodies[j];

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;

        const distSq = dx * dx + dy * dy + this.softening * this.softening;
        const dist = Math.sqrt(distSq);
        const invDist3 = 1.0 / (distSq * dist); // 1 / r^3

        const factor = this.G * invDist3;

        const ax = factor * dx;
        const ay = factor * dy;

        bi.acceleration.x += ax * bj.mass;
        bi.acceleration.y += ay * bj.mass;

        bj.acceleration.x -= ax * bi.mass;
        bj.acceleration.y -= ay * bi.mass;
      }
    }
  }

  /**
   * Integrate motion with a semi-implicit (symplectic) Euler step
   * and update trails for rendering.
   */
  _integrate(dt) {
    for (const body of this.bodies) {
      body.velocity.x += body.acceleration.x * dt;
      body.velocity.y += body.acceleration.y * dt;

      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;

      body.trail.push({
        x: body.position.x,
        y: body.position.y,
      });

      if (TRAIL_LENGTH !== -1 && body.trail.length > TRAIL_LENGTH) {
        body.trail.shift();
      }
    }
  }

  /**
   * Detect and resolve collisions.
   * For each overlapping pair, we remove both bodies and replace them
   * with zero or more new bodies (merged cores and/or fragments).
   */
  _resolveCollisions() {
    const n = this.bodies.length;
    const alive = new Array(n).fill(true);
    const generatedBodies = [];

    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const bi = this.bodies[i];

      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        const bj = this.bodies[j];

        const dx = bj.position.x - bi.position.x;
        const dy = bj.position.y - bi.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = bi.radius + bj.radius;

        if (dist < minDist) {
          const outcome = this._computeCollisionOutcome(bi, bj);

          if (Array.isArray(outcome)) {
            for (const nb of outcome) {
              if (!nb) continue;
              if (!Number.isFinite(nb.mass) || nb.mass <= 0) continue;
              if (!Number.isFinite(nb.radius) || nb.radius <= 0.5) continue;

              generatedBodies.push(nb);
            }
          }

          alive[i] = false;
          alive[j] = false;
          this.collisionCount++;
          break;
        }
      }
    }

    const result = [];
    for (let i = 0; i < n; i++) {
      if (alive[i]) result.push(this.bodies[i]);
    }

    for (const nb of generatedBodies) {
      if (result.length >= MAX_BODIES) break;
      result.push(nb);
    }

    this.bodies = result;
  }

  /**
   * Classify a collision based on impact energy and mass ratio and choose
   * between:
   *  - inelastic merge (low energy),
   *  - big–small impact with debris,
   *  - mutual fragmentation (similar masses, high energy).
   *
   * Returns a list of new bodies that replace the colliding pair.
   */
  _computeCollisionOutcome(b1, b2) {
    const m1 = b1.mass;
    const m2 = b2.mass;
    const totalMass = m1 + m2;

    if (totalMass <= 0) {
      return [];
    }

    const v1 = b1.velocity;
    const v2 = b2.velocity;
    const p1 = b1.position;
    const p2 = b2.position;

    // Impact direction and orthogonal basis
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let dist = Math.hypot(dx, dy);
    if (dist === 0) {
      // Degenerate case: overlapping centers
      dist = b1.radius + b2.radius || 1;
      dx = 1;
      dy = 0;
    }
    const normal = new Vec2(dx / dist, dy / dist);
    const tangent = new Vec2(-normal.y, normal.x);

    // Relative velocity and speed
    const relVx = v1.x - v2.x;
    const relVy = v1.y - v2.y;
    const speedRel = Math.hypot(relVx, relVy);

    // Center-of-mass velocity (used as base for most outcomes)
    const vcmx = (v1.x * m1 + v2.x * m2) / totalMass;
    const vcmy = (v1.y * m1 + v2.y * m2) / totalMass;
    const vcm = new Vec2(vcmx, vcmy);

    // Characteristic escape velocity for normalization
    const R_eff = Math.max(b1.radius, b2.radius);
    const vEsc = Math.sqrt((2 * this.G * totalMass) / (R_eff + this.softening));

    const alpha = Number.isFinite(vEsc) && vEsc > 1e-6 ? speedRel / vEsc : 0;

    const massRatio = m1 >= m2 ? m1 / m2 : m2 / m1;

    const baseDebug = {
      time: this.time,
      m1,
      m2,
      totalMass,
      r1: b1.radius,
      r2: b2.radius,
      pos1: { x: p1.x, y: p1.y },
      pos2: { x: p2.x, y: p2.y },
      v1: { x: v1.x, y: v1.y },
      v2: { x: v2.x, y: v2.y },
      speedRel,
      vEsc,
      alpha,
      massRatio,
      isDebris1: !!b1.isDebris,
      isDebris2: !!b2.isDebris,
    };

    // Low-energy impact: pure inelastic merge
    if (alpha < ALPHA_MERGE) {
      this._recordCollisionDebug({
        ...baseDebug,
        outcome: 'mergeLowEnergy',
      });

      return [this._createMergedBody(b1, b2)];
    }

    // Big–small impact: smaller body is mostly disrupted/absorbed
    if (massRatio > MASS_RATIO_BIG) {
      const big = m1 >= m2 ? b1 : b2;
      const small = big === b1 ? b2 : b1;

      this._recordCollisionDebug({
        ...baseDebug,
        outcome: 'bigSmallFragment',
        bigIsB1: big === b1,
      });

      return this._collisionBigSmall(big, small, alpha, normal, tangent, vcm);
    }

    // Similar masses, sufficiently energetic impact: mutual fragmentation
    this._recordCollisionDebug({
      ...baseDebug,
      outcome: 'fragmentBoth',
    });

    return this._fragmentBoth(b1, b2, alpha, normal, tangent, vcm);
  }

  /**
   * Produce a visual descriptor for debris fragments.
   * Each fragment is roughly circular but with a noisy outline,
   * so it looks like a broken piece of a larger body.
   */
  _createDebrisShape() {
    const sides = 6 + Math.floor(Math.random() * 4); // 6–9 "edge samples"
    const vertexJitter = [];
    for (let i = 0; i < sides; i++) {
      // Radial factor for each vertex (0.6–1.4 of base radius)
      vertexJitter.push(0.6 + Math.random() * 0.8);
    }

    return {
      type: 'fragment',
      sides,
      angle: Math.random() * Math.PI * 2,
      vertexJitter,
    };
  }

  /**
   * Standard inelastic merge (momentum-conserving fusion).
   */
  _createMergedBody(bi, bj) {
    const totalMass = bi.mass + bj.mass;

    const vx = (bi.velocity.x * bi.mass + bj.velocity.x * bj.mass) / totalMass;
    const vy = (bi.velocity.y * bi.mass + bj.velocity.y * bj.mass) / totalMass;

    const x = (bi.position.x * bi.mass + bj.position.x * bj.mass) / totalMass;
    const y = (bi.position.y * bi.mass + bj.position.y * bj.mass) / totalMass;

    const newRadius = radiusFromMass(totalMass);

    const dominant = bi.mass >= bj.mass ? bi : bj;
    const mergedBody = new Body({
      position: new Vec2(x, y),
      velocity: new Vec2(vx, vy),
      mass: totalMass,
      radius: newRadius,
      color: dominant.color,
      name: dominant.name,
    });

    mergedBody.trail = bi.trail.length > bj.trail.length ? [...bi.trail] : [...bj.trail];

    return mergedBody;
  }

  /**
   * Big–small impact:
   * the small body is mostly absorbed, while a fraction of its mass
   * becomes fragments that explode around the impact point.
   */
  _collisionBigSmall(big, small, alpha, normal, tangent, vcm) {
    const mBig = big.mass;
    const mSmall = small.mass;
    const totalMass = mBig + mSmall;

    // t in [0, 1] as a function of impact intensity
    const t = Math.max(0, Math.min(1, (alpha - 0.6) / (2.0 - 0.6)));

    // Fraction of the small body's mass that becomes fragments (30% -> 90%)
    const fracSmallToFragments = 0.3 + 0.6 * t;

    const fragmentMassTotal = mSmall * fracSmallToFragments;
    const mergedMass = mBig + mSmall - fragmentMassTotal;
    const mergedRadius = radiusFromMass(mergedMass);

    // Contact point on the surface of the big body
    let dir = new Vec2(small.position.x - big.position.x, small.position.y - big.position.y);
    let dist = Math.hypot(dir.x, dir.y);
    if (dist === 0) {
      // Fallback: use normal if centers coincide numerically
      dir = new Vec2(normal.x, normal.y);
      dist = 1;
    } else {
      dir.x /= dist;
      dir.y /= dist;
    }

    const contactPoint = new Vec2(
      big.position.x + dir.x * big.radius,
      big.position.y + dir.y * big.radius
    );

    // Resulting core near the combined center of mass
    const comX = (big.position.x * mBig + small.position.x * mSmall) / totalMass;
    const comY = (big.position.y * mBig + small.position.y * mSmall) / totalMass;

    const mergedBody = new Body({
      position: new Vec2(comX, comY),
      velocity: new Vec2(vcm.x, vcm.y),
      mass: mergedMass,
      radius: mergedRadius,
      color: big.color,
      name: big.name,
    });
    mergedBody.trail = big.trail.length >= small.trail.length ? [...big.trail] : [...small.trail];

    const newBodies = [mergedBody];

    // "Tomato splash" fragments around the impact zone
    const MAX_FRAGMENTS = 8;
    if (fragmentMassTotal > 0 && mergedRadius > 0) {
      const fragCount = Math.min(MAX_FRAGMENTS, Math.max(4, Math.round(4 + alpha * 2)));
      const singleFragMass = fragmentMassTotal / fragCount;

      const baseOffset = Math.min(mergedRadius * 0.9, small.radius * 3);
      const baseKick = alpha * 0.6 * DEBRIS_EXTRA_KICK;

      // Roughly orient the ring outward from the normal
      const baseAngle = Math.atan2(normal.y, normal.x) + Math.PI;

      for (let k = 0; k < fragCount; k++) {
        const jitterAngle = (Math.random() - 0.5) * (Math.PI / fragCount);
        const angle = baseAngle + (2 * Math.PI * k) / fragCount + jitterAngle;

        const dirFrag = new Vec2(Math.cos(angle), Math.sin(angle));

        const distJitter = 0.8 + 0.6 * Math.random();
        const pos = new Vec2(
          contactPoint.x + dirFrag.x * baseOffset * distJitter,
          contactPoint.y + dirFrag.y * baseOffset * distJitter
        );

        const speedJitter = 0.8 + 0.8 * Math.random();
        const vel = new Vec2(
          vcm.x + dirFrag.x * baseKick * speedJitter,
          vcm.y + dirFrag.y * baseKick * speedJitter
        );

        const fragRadius = radiusFromMass(singleFragMass);

        const frag = new Body({
          position: pos,
          velocity: vel,
          mass: singleFragMass,
          radius: fragRadius,
          color: small.color,
          name: small.name,
        });
        frag.trail = [];

        frag.isDebris = true;
        frag.shape = this._createDebrisShape();

        newBodies.push(frag);
      }
    }

    return newBodies;
  }

  /**
   * High-energy impact between similar masses:
   * both bodies lose mass and generate a ring of fragments.
   */
  _fragmentBoth(b1, b2, alpha, normal, tangent, vcm) {
    const m1 = b1.mass;
    const m2 = b2.mass;
    const totalMass = m1 + m2;

    // Relative vulnerability: lighter body breaks more easily
    const damage1 = m2 / Math.pow(m1, 1.5);
    const damage2 = m1 / Math.pow(m2, 1.5);
    const damageSum = damage1 + damage2 || 1;

    // Fraction of mass converted to debris
    // alpha ~1 -> little debris, large alpha -> most of the mass in fragments
    const baseLoss = Math.min(0.9, Math.max(0.15, 0.5 + 0.35 * (alpha - 2.0)));
    const fracLoss1 = baseLoss * (damage1 / damageSum);
    const fracLoss2 = baseLoss * (damage2 / damageSum);

    let lostMass1 = fracLoss1 * m1;
    let lostMass2 = fracLoss2 * m2;

    lostMass1 = Math.min(lostMass1, 0.9 * m1);
    lostMass2 = Math.min(lostMass2, 0.9 * m2);

    const coreMass1 = m1 - lostMass1;
    const coreMass2 = m2 - lostMass2;

    const newBodies = [];

    // Keep surviving cores if enough mass remains
    const CORE_MIN_FRAC = 0.2;

    if (coreMass1 / m1 > CORE_MIN_FRAC) {
      const coreRadius1 = radiusFromMass(coreMass1);
      const core1 = new Body({
        position: new Vec2(b1.position.x, b1.position.y),
        velocity: new Vec2(vcm.x, vcm.y),
        mass: coreMass1,
        radius: coreRadius1,
        color: b1.color,
        name: b1.name,
      });
      core1.trail = [...b1.trail];
      core1.mergeCooldown = (this.time || 0) + 0.5;
      newBodies.push(core1);
    }

    if (coreMass2 / m2 > CORE_MIN_FRAC) {
      const coreRadius2 = radiusFromMass(coreMass2);
      const core2 = new Body({
        position: new Vec2(b2.position.x, b2.position.y),
        velocity: new Vec2(vcm.x, vcm.y),
        mass: coreMass2,
        radius: coreRadius2,
        color: b2.color,
        name: b2.name,
      });
      core2.trail = [...b2.trail];
      core2.mergeCooldown = (this.time || 0) + 0.5;
      newBodies.push(core2);
    }

    const fragmentMassTotal = lostMass1 + lostMass2;

    if (fragmentMassTotal <= 0) {
      return newBodies;
    }

    const MAX_FRAGMENTS = 10;
    const fragCount = Math.min(MAX_FRAGMENTS, Math.max(6, Math.round(6 + alpha * 2)));
    const singleFragMass = fragmentMassTotal / fragCount;

    // Contact point between the two surfaces (not the global center of mass)
    const surf1 = new Vec2(
      b1.position.x + normal.x * b1.radius,
      b1.position.y + normal.y * b1.radius
    );
    const surf2 = new Vec2(
      b2.position.x - normal.x * b2.radius,
      b2.position.y - normal.y * b2.radius
    );
    const contactPoint = new Vec2((surf1.x + surf2.x) / 2, (surf1.y + surf2.y) / 2);

    const baseOffset = Math.max(1, 0.6 * Math.min(b1.radius, b2.radius));
    const baseKick = alpha * 0.7 * DEBRIS_EXTRA_KICK;

    const baseAngle = Math.atan2(normal.y, normal.x);

    for (let k = 0; k < fragCount; k++) {
      const jitterAngle = (Math.random() - 0.5) * (Math.PI / fragCount);
      const angle = baseAngle + (2 * Math.PI * k) / fragCount + jitterAngle;

      const dirFrag = new Vec2(Math.cos(angle), Math.sin(angle));

      const distJitter = 0.8 + 0.6 * Math.random();
      const pos = new Vec2(
        contactPoint.x + dirFrag.x * baseOffset * distJitter,
        contactPoint.y + dirFrag.y * baseOffset * distJitter
      );

      const speedJitter = 0.8 + 0.8 * Math.random();
      const vel = new Vec2(
        vcm.x + dirFrag.x * baseKick * speedJitter,
        vcm.y + dirFrag.y * baseKick * speedJitter
      );

      const fragRadius = radiusFromMass(singleFragMass);

      const color = damage1 > damage2 ? b1.color : b2.color;

      const frag = new Body({
        position: pos,
        velocity: vel,
        mass: singleFragMass,
        radius: fragRadius,
        color,
        name: null,
      });
      frag.trail = [];

      // Cinematic debris fragment
      frag.isDebris = true;
      frag.shape = this._createDebrisShape();

      newBodies.push(frag);
    }

    return newBodies;
  }
}
