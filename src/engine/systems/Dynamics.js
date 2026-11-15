import { PHYSICS } from '../../shared/config/PhysicsConfig.js';

export class Dynamics {
  /**
   * Applies the Barnes-Hut algorithm to calculate gravitational accelerations on all bodies.
   * Formula: a = G * m / (r^2 + softening^2)
   * The QuadTree is used to approximate distant clusters of mass as single bodies (O(N log N)).
   */
  static applyGravity(bodies, gravityTree) {
    const G = PHYSICS.GRAVITY_CONSTANT;
    const softening = PHYSICS.SOFTENING;
    const minMass = PHYSICS.MIN_GRAVITY_MASS;
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const body = bodies[i];
      body.resetAcceleration();

      if (body.mass > minMass) {
        gravityTree.insert(body);
      }
    }

    for (let i = 0; i < count; i++) {
      const body = bodies[i];
      gravityTree.accumulateAcceleration(body, G, softening);
      body.accelerationValid = true;
    }
  }

  /**
   * Performs the first step of Velocity Verlet integration: updates position and half-velocity.
   * Position: r(t+dt) = r(t) + v(t)dt + 0.5 * a(t) * dt^2
   * Velocity (half): v(t+0.5dt) = v(t) + 0.5 * a(t) * dt
   * Also handles the recording of trail points based on distance thresholds.
   */
  static integratePosition(bodies, dt, updateTrail) {
    const halfDt = dt * 0.5;
    const dtSqHalf = dt * dt * 0.5;

    const minTrailDistSq = PHYSICS.MIN_TRAIL_DISTANCE_SQ;

    for (const body of bodies) {
      const ax = body.acceleration.x;
      const ay = body.acceleration.y;

      body.position.x += body.velocity.x * dt + ax * dtSqHalf;
      body.position.y += body.velocity.y * dt + ay * dtSqHalf;

      body.velocity.x += ax * halfDt;
      body.velocity.y += ay * halfDt;

      if (updateTrail) {
        const trail = body.trail;
        let shouldAdd = trail.length === 0;

        if (!shouldAdd) {
          const dx = body.position.x - trail.lastX();
          const dy = body.position.y - trail.lastY();
          shouldAdd = dx * dx + dy * dy > minTrailDistSq;
        }

        if (shouldAdd) {
          trail.push(body.position.x, body.position.y);
        }
      }
    }
  }

  /**
   * Performs the second step of Velocity Verlet integration: updates full velocity.
   * Velocity: v(t+dt) = v(t+0.5dt) + 0.5 * a(t+dt) * dt
   */
  static integrateVelocity(bodies, dt) {
    const halfDt = dt * 0.5;
    for (const body of bodies) {
      body.velocity.x += body.acceleration.x * halfDt;
      body.velocity.y += body.acceleration.y * halfDt;
    }
  }
}
