import { Body } from '../../engine/Body.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { configureCameraForSeed } from '../../shared/utils/CameraUtils.js';
import { massFromRadius, PHYSICS } from '../../shared/config/PhysicsConfig.js';

export function seedBinaryDisk({ world, eventBus }) {
  if (!world) return;
  world.clear();

  const G = PHYSICS.GRAVITY_CONSTANT;
  const STAR_RADIUS = 40;
  const STAR_MASS = massFromRadius(STAR_RADIUS);
  const SEPARATION = 300;
  const ORBIT_SPEED = Math.sqrt((G * STAR_MASS) / (2 * SEPARATION));

  const star1 = new Body({
    position: new Vec2(-SEPARATION, 0),
    velocity: new Vec2(0, ORBIT_SPEED),
    mass: STAR_MASS,
    radius: STAR_RADIUS,
    color: '#ff8a6c',
    name: 'Alpha',
  });

  const star2 = new Body({
    position: new Vec2(SEPARATION, 0),
    velocity: new Vec2(0, -ORBIT_SPEED),
    mass: STAR_MASS,
    radius: STAR_RADIUS,
    color: '#6cc0ff',
    name: 'Beta',
  });

  world.addBody(star1);
  world.addBody(star2);

  const DISK_COUNT = 400;
  const MIN_R = SEPARATION * 2.5;
  const MAX_R = SEPARATION * 8;
  const CENTER_MASS = STAR_MASS * 2;

  for (let i = 0; i < DISK_COUNT; i++) {
    const dist = MIN_R + Math.random() * (MAX_R - MIN_R);
    const angle = Math.random() * Math.PI * 2;

    const pos = new Vec2(dist * Math.cos(angle), dist * Math.sin(angle));
    const vMag = Math.sqrt((G * CENTER_MASS) / dist);
    const vel = new Vec2(-Math.sin(angle) * vMag, Math.cos(angle) * vMag);
    const r = 1.5 + Math.random() * 2.5;

    world.addBody(
      new Body({
        position: pos,
        velocity: vel,
        mass: massFromRadius(r),
        radius: r,
        color: '#b0b7c2',
      })
    );
  }

  eventBus.emit('camera:set-position', { dx: 0, dy: 0, zoom: 0.3 });
}
