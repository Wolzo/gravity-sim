import { PHYSICS } from '../../shared/config/PhysicsConfig.js';

export class Dynamics {
  /**
   * Applies the Barnes-Hut algorithm to calculate gravitational forces on all bodies.
   * Formula: F = G * (m1 * m2) / (r^2 + softening^2)
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
      const force = gravityTree.calculateForce(body, G, softening);
      body.acceleration.x += force.x;
      body.acceleration.y += force.y;
    }
  }

  /**
   * Performs the first step of Velocity Verlet integration: updates position and half-velocity.
   * Position: r(t+dt) = r(t) + v(t)dt + 0.5 * a(t) * dt^2
   * Velocity (half): v(t+0.5dt) = v(t) + 0.5 * a(t) * dt
   * * Also handles the recording of trail points based on distance thresholds.
   */
  static integratePosition(bodies, dt, updateTrail) {
    const halfDt = dt * 0.5;
    const dtSqHalf = dt * dt * 0.5;

    const minTrailDist = PHYSICS.MIN_TRAIL_DISTANCE_SQ;
    const maxTrailLen = PHYSICS.TRAIL_LENGTH;

    for (const body of bodies) {
      const ax = body.acceleration.x;
      const ay = body.acceleration.y;

      body.position.x += body.velocity.x * dt + ax * dtSqHalf;
      body.position.y += body.velocity.y * dt + ay * dtSqHalf;

      body.velocity.x += ax * halfDt;
      body.velocity.y += ay * halfDt;

      if (updateTrail) {
        let shouldAdd = false;
        const trail = body.trail;

        if (trail.length === 0) {
          shouldAdd = true;
        } else {
          const last = trail[trail.length - 1];
          const dx = body.position.x - last.x;
          const dy = body.position.y - last.y;
          if (dx * dx + dy * dy > minTrailDist) {
            shouldAdd = true;
          }
        }

        if (shouldAdd) {
          trail.push({ x: body.position.x, y: body.position.y });
          if (maxTrailLen !== -1 && trail.length > maxTrailLen) {
            trail.shift();
          }
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
