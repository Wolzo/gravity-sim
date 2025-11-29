import { PHYSICS, radiusFromMass, massFromRadius } from '../../shared/config/PhysicsConfig.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { computeEscapeVelocity, clamp } from '../../shared/math/MathUtils.js';
import { Body } from '../../engine/Body.js';
import { generateDelaunayShapes } from '../logic/DebrisGenerator.js';

export class CollisionResolver {
  constructor({ G, softening, getTime, events }) {
    this.G = G;
    this.softening = softening;
    this.getTime = getTime;
    this.events = events;
  }

  /**
   * Determines the outcome of a collision between two bodies.
   * Returns an array of new bodies generated (if any).
   */
  computeOutcome(b1, b2) {
    const m1 = b1.mass;
    const m2 = b2.mass;
    const totalMass = m1 + m2;

    if (totalMass <= 0) return [];

    const ratio = m1 > m2 ? m1 / m2 : m2 / m1;
    if (ratio > 1000) {
      return [this._createMergedBody(b1, b2)];
    }

    const v1 = b1.velocity;
    const v2 = b2.velocity;
    const p1 = b1.position;
    const p2 = b2.position;

    const normal = Vec2.pop();
    const tangent = Vec2.pop();
    const vcm = Vec2.pop();

    try {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      let dist = Math.hypot(dx, dy);

      if (dist === 0) {
        dist = b1.radius + b2.radius || 1;
        dx = 1;
        dy = 0;
      }

      normal.set(dx / dist, dy / dist);
      tangent.set(-normal.y, normal.x);

      const relVx = v1.x - v2.x;
      const relVy = v1.y - v2.y;
      const speedRel = Math.hypot(relVx, relVy);

      vcm.set((v1.x * m1 + v2.x * m2) / totalMass, (v1.y * m1 + v2.y * m2) / totalMass);

      const R_eff = Math.max(b1.radius, b2.radius);
      const vEsc = computeEscapeVelocity(this.G, totalMass, R_eff, this.softening);
      const alpha = vEsc > 1e-6 ? speedRel / vEsc : 0;

      const massRatio = m1 >= m2 ? m1 / m2 : m2 / m1;
      const time = this.getTime() || 0;

      if (alpha < PHYSICS.ALPHA_MERGE) {
        return [this._createMergedBody(b1, b2)];
      }

      if (massRatio > PHYSICS.MASS_RATIO_BIG) {
        const big = m1 >= m2 ? b1 : b2;
        const small = big === b1 ? b2 : b1;
        return this._collisionBigSmall(big, small, alpha, normal, tangent, vcm);
      }

      return this._fragmentBoth(b1, b2, alpha, normal, tangent, vcm, time);
    } finally {
      Vec2.push(normal);
      Vec2.push(tangent);
      Vec2.push(vcm);
    }
  }

  _createMergedBody(bi, bj) {
    const totalMass = bi.mass + bj.mass;
    const vx = (bi.velocity.x * bi.mass + bj.velocity.x * bj.mass) / totalMass;
    const vy = (bi.velocity.y * bi.mass + bj.velocity.y * bj.mass) / totalMass;
    const x = (bi.position.x * bi.mass + bj.position.x * bj.mass) / totalMass;
    const y = (bi.position.y * bi.mass + bj.position.y * bj.mass) / totalMass;
    const newRadius = Math.sqrt(bi.radius * bi.radius + bj.radius * bj.radius);

    const dominant = bi.mass >= bj.mass ? bi : bj;

    const mergedBody = new Body({
      position: new Vec2(x, y),
      velocity: new Vec2(vx, vy),
      mass: totalMass,
      radius: newRadius,
      color: dominant.color,
      name: dominant.name,
    });

    return mergedBody;
  }

  _collisionBigSmall(big, small, alpha, normal, _tangent, vcm) {
    const mBig = big.mass;
    const mSmall = small.mass;
    const totalMass = mBig + mSmall;

    const destructionFactor = Math.min(1.0, 0.2 + alpha * 0.5);
    const fragmentMassTotal = mSmall * Math.max(0.8, destructionFactor);
    const mergedMass = mBig + (mSmall - fragmentMassTotal);
    const mergedRadius = big.radius * Math.sqrt(mergedMass / mBig);

    const dir = Vec2.pop();
    dir.set(small.position.x - big.position.x, small.position.y - big.position.y);
    let dist = Math.hypot(dir.x, dir.y);
    if (dist === 0) {
      dir.set(normal.x, normal.y);
      dist = 1;
    } else {
      dir.scale(1 / dist);
    }

    const contactPointX = big.position.x + dir.x * big.radius;
    const contactPointY = big.position.y + dir.y * big.radius;
    const tanX = -dir.y;
    const tanY = dir.x;

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

    mergedBody.collisionCooldown = this.getTime() + 0.5;
    const newBodies = [mergedBody];

    if (alpha > PHYSICS.VAPORIZE_THRESHOLD || fragmentMassTotal <= 0 || mergedRadius <= 0) {
      Vec2.push(dir);
      return newBodies;
    }

    if (fragmentMassTotal > 0) {
      const baseCount = 10;
      const density = 8;
      const rawCount = Math.round(baseCount + alpha * density);
      const fragCount = Math.min(PHYSICS.MAX_FRAGMENTS, Math.max(6, rawCount));
      const singleFragMass = fragmentMassTotal / fragCount;
      const fragRadius = radiusFromMass(singleFragMass);
      const baseKick = alpha * 0.6 * PHYSICS.DEBRIS_EXTRA_KICK;
      const baseAngle = Math.atan2(dir.y, dir.x);

      const debrisShapes = generateDelaunayShapes(radiusFromMass(mSmall), fragCount);
      const impactSpreadWidth = small.radius * 2.5;

      const dirFrag = Vec2.pop();
      const spreadAngle = Math.PI / 3;

      for (let k = 0; k < fragCount; k++) {
        const angleOffset = (Math.random() - 0.5) * spreadAngle;
        const angle = baseAngle + angleOffset;

        dirFrag.set(Math.cos(angle), Math.sin(angle));

        const speedJitter = 0.5 + 1.0 * Math.random();
        const lateralOffset = (Math.random() - 0.5) * impactSpreadWidth;
        const outwardOffset = fragRadius + 2.0 + Math.random() * small.radius * 0.5;

        const pos = new Vec2(
          contactPointX + dir.x * outwardOffset + tanX * lateralOffset,
          contactPointY + dir.y * outwardOffset + tanY * lateralOffset
        );
        const vel = new Vec2(
          vcm.x + dirFrag.x * baseKick * speedJitter,
          vcm.y + dirFrag.y * baseKick * speedJitter
        );

        const frag = new Body({
          position: pos,
          velocity: vel,
          mass: singleFragMass,
          radius: fragRadius,
          color: small.color,
          name: small.name,
        });

        frag.isDebris = true;
        frag.shape = debrisShapes[k % debrisShapes.length];
        frag.collisionCooldown = this.getTime() + 0.5;

        newBodies.push(frag);
      }
      Vec2.push(dirFrag);
    }

    Vec2.push(dir);
    return newBodies;
  }

  _fragmentBoth(b1, b2, alpha, normal, _tangent, vcm, time) {
    const m1 = b1.mass;
    const m2 = b2.mass;

    const damage1 = m2 / Math.pow(m1 || 1, 1.5);
    const damage2 = m1 / Math.pow(m2 || 1, 1.5);
    const damageSum = damage1 + damage2 || 1;
    const baseLoss = clamp(0.5 + 0.35 * (alpha - 2.0), 0.15, 0.9);
    const fracLoss1 = baseLoss * (damage1 / damageSum);
    const fracLoss2 = baseLoss * (damage2 / damageSum);

    const lostMass1 = Math.min(fracLoss1 * m1, 0.9 * m1);
    const lostMass2 = Math.min(fracLoss2 * m2, 0.9 * m2);
    const coreMass1 = m1 - lostMass1;
    const coreMass2 = m2 - lostMass2;

    const newBodies = [];
    const CORE_MIN_FRAC = 0.2;

    if (alpha > PHYSICS.VAPORIZE_THRESHOLD) {
      return newBodies;
    }

    if (coreMass1 / m1 > CORE_MIN_FRAC) {
      const core1 = new Body({
        position: new Vec2(b1.position.x, b1.position.y),
        velocity: new Vec2(vcm.x, vcm.y),
        mass: coreMass1,
        radius: radiusFromMass(coreMass1),
        color: b1.color,
        name: b1.name,
      });
      core1.collisionCooldown = (time || 0) + 0.5;
      newBodies.push(core1);
    }

    if (coreMass2 / m2 > CORE_MIN_FRAC) {
      const core2 = new Body({
        position: new Vec2(b2.position.x, b2.position.y),
        velocity: new Vec2(vcm.x, vcm.y),
        mass: coreMass2,
        radius: radiusFromMass(coreMass2),
        color: b2.color,
        name: b2.name,
      });
      core2.collisionCooldown = (time || 0) + 0.5;
      newBodies.push(core2);
    }

    const fragmentMassTotal = lostMass1 + lostMass2;
    const fragmentMassRadius = radiusFromMass(fragmentMassTotal);

    if (fragmentMassTotal <= 0) return newBodies;

    const MIN_FRAG_RADIUS = Math.max(1.2, 0.12 * Math.min(b1.radius, b2.radius));
    const minFragMass = Math.max(massFromRadius(MIN_FRAG_RADIUS), 1e-8);
    const maxByMass = Math.max(3, Math.floor(fragmentMassTotal / minFragMass));

    const fragCount = Math.min(
      PHYSICS.MAX_FRAGMENTS,
      Math.max(6, Math.min(maxByMass, Math.round(6 + alpha * 2)))
    );
    const singleFragMass = fragmentMassTotal / fragCount;

    const surf1X = b1.position.x + normal.x * b1.radius;
    const surf1Y = b1.position.y + normal.y * b1.radius;
    const surf2X = b2.position.x - normal.x * b2.radius;
    const surf2Y = b2.position.y - normal.y * b2.radius;
    const cpX = (surf1X + surf2X) / 2;
    const cpY = (surf1Y + surf2Y) / 2;

    const baseOffset = Math.max(1, 0.6 * Math.min(b1.radius, b2.radius));
    const dvx = b2.velocity.x - b1.velocity.x;
    const dvy = b2.velocity.y - b1.velocity.y;
    const vRelN = Math.abs(dvx * normal.x + dvy * normal.y);
    const rLocal = Math.max(b1.radius + b2.radius, 1.0);
    const vEscLocal = Math.sqrt((2 * this.G * (m1 + m2)) / rLocal);
    const baseKick = Math.min(alpha * 0.7 * PHYSICS.DEBRIS_EXTRA_KICK, vEscLocal + 0.8 * vRelN);
    const baseAngle = Math.atan2(normal.y, normal.x);

    const debrisShapes = generateDelaunayShapes(fragmentMassRadius, fragCount);

    const dirFrag = Vec2.pop();
    for (let k = 0; k < fragCount; k++) {
      const jitterAngle = (Math.random() - 0.5) * (Math.PI / fragCount);
      const angle = baseAngle + (2 * Math.PI * k) / fragCount + jitterAngle;

      dirFrag.set(Math.cos(angle), Math.sin(angle));
      const distJitter = 0.8 + 0.6 * Math.random();
      const speedJitter = 0.8 + 0.8 * Math.random();

      const pos = new Vec2(
        cpX + dirFrag.x * baseOffset * distJitter,
        cpY + dirFrag.y * baseOffset * distJitter
      );
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

      frag.isDebris = true;
      frag.shape = debrisShapes[k % debrisShapes.length];
      frag.collisionCooldown = this.getTime() + 0.5;

      newBodies.push(frag);
    }
    Vec2.push(dirFrag);

    return newBodies;
  }
}
