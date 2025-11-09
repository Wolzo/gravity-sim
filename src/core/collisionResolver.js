import { GRAVITY_CONSTANT, SOFTENING, radiusFromMass } from './config.js';
import { Vec2 } from './vector2.js';
import { Body } from './body.js';
import { createDebrisShape } from './debrisShapes.js';
import { computeCenterOfMassVelocity, computeEscapeVelocity } from '../utils/physicsUtils.js';
import { clamp } from '../utils/utils.js';

// Tuning constants for cinematic fragmentation
const DEBRIS_EXTRA_KICK = 5.0; // multiplier for fragment ejection speed
const MASS_RATIO_BIG = 4; // above this, treat collision as big–small
const ALPHA_MERGE = 0.25; // below this, always inelastic merge

/**
 * Handles classification and resolution of pair-wise collisions.
 * It is stateless with respect to bodies, but keeps a reference
 * to global parameters (G, softening, time, debug hook).
 */
export class CollisionResolver {
  constructor({
    G = GRAVITY_CONSTANT,
    softening = SOFTENING,
    getTime = () => 0,
    recordDebug = () => {},
  } = {}) {
    this.G = G;
    this.softening = softening;
    this.getTime = getTime;
    this.recordDebug = recordDebug;
  }

  /**
   * Compute the outcome of a collision between b1 and b2.
   * Returns an array of new bodies replacing the pair.
   */
  computeOutcome(b1, b2) {
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
    const vcmObj = computeCenterOfMassVelocity(m1, v1, m2, v2);
    const vcm = new Vec2(vcmObj.x, vcmObj.y);

    // Characteristic escape velocity for normalization
    const R_eff = Math.max(b1.radius, b2.radius);
    const vEsc = computeEscapeVelocity(this.G, totalMass, R_eff, this.softening);
    const alpha = vEsc > 1e-6 ? speedRel / vEsc : 0;

    const massRatio = m1 >= m2 ? m1 / m2 : m2 / m1;
    const time = this.getTime() || 0;

    const baseDebug = {
      time,
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
      this.recordDebug({
        ...baseDebug,
        outcome: 'mergeLowEnergy',
      });

      return [this._createMergedBody(b1, b2)];
    }

    // Big–small impact: smaller body is mostly disrupted/absorbed
    if (massRatio > MASS_RATIO_BIG) {
      const big = m1 >= m2 ? b1 : b2;
      const small = big === b1 ? b2 : b1;

      this.recordDebug({
        ...baseDebug,
        outcome: 'bigSmallFragment',
        bigIsB1: big === b1,
      });

      return this._collisionBigSmall(big, small, alpha, normal, tangent, vcm);
    }

    // Similar masses, sufficiently energetic impact: mutual fragmentation
    this.recordDebug({
      ...baseDebug,
      outcome: 'fragmentBoth',
    });

    return this._fragmentBoth(b1, b2, alpha, normal, tangent, vcm, time);
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
  _collisionBigSmall(big, small, alpha, normal, _tangent, vcm) {
    const mBig = big.mass;
    const mSmall = small.mass;
    const totalMass = mBig + mSmall;

    // t in [0, 1] as a function of impact intensity
    const t = clamp((alpha - 0.6) / (2.0 - 0.6), 0, 1);

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
        frag.shape = createDebrisShape();

        newBodies.push(frag);
      }
    }

    return newBodies;
  }

  /**
   * High-energy impact between similar masses:
   * both bodies lose mass and generate a ring of fragments.
   */
  _fragmentBoth(b1, b2, alpha, normal, _tangent, vcm, time) {
    const m1 = b1.mass;
    const m2 = b2.mass;
    const totalMass = m1 + m2;

    // Relative vulnerability: lighter body breaks more easily
    const damage1 = m2 / Math.pow(m1 || 1, 1.5);
    const damage2 = m1 / Math.pow(m2 || 1, 1.5);
    const damageSum = damage1 + damage2 || 1;

    // Fraction of mass converted to debris
    // alpha ~1 -> little debris, large alpha -> most of the mass in fragments
    const baseLoss = clamp(0.5 + 0.35 * (alpha - 2.0), 0.15, 0.9);
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
      core1.mergeCooldown = (time || 0) + 2.0;
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
      core2.mergeCooldown = (time || 0) + 2.0;
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

      frag.isDebris = true;
      frag.shape = createDebrisShape();

      newBodies.push(frag);
    }

    return newBodies;
  }
}
