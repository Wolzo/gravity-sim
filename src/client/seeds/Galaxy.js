import { Body } from '../../engine/Body.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { configureCameraForSeed } from '../../shared/utils/CameraUtils.js';
import { massFromRadius, radiusFromMass, PHYSICS } from '../../shared/config/PhysicsConfig.js';

export function seedGalaxy({ world, renderer }) {
  if (!world) return;
  world.clear();

  const G = PHYSICS.GRAVITY_CONSTANT;
  const CORE_MASS = 80000;
  const STAR_COUNT = 600;
  const ARMS = 3;
  const ARM_TWIST = 4.0;
  const GALAXY_RADIUS = 3000;

  world.addBody(
    new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(0, 0),
      mass: CORE_MASS,
      radius: radiusFromMass(CORE_MASS) * 0.5,
      color: '#ffffff',
      name: 'Sagittarius A*',
    })
  );

  for (let i = 0; i < STAR_COUNT; i++) {
    const d = 200 + Math.random() * Math.random() * GALAXY_RADIUS;
    const armIndex = i % ARMS;
    const baseAngle = (armIndex / ARMS) * Math.PI * 2;
    const twist = (d / GALAXY_RADIUS) * ARM_TWIST;
    const angle = baseAngle + twist + (Math.random() - 0.5) * 0.5;
    const pos = new Vec2(d * Math.cos(angle), d * Math.sin(angle));

    const vMag = Math.sqrt((G * CORE_MASS) / d);
    const vel = new Vec2(-Math.sin(angle) * vMag, Math.cos(angle) * vMag);

    const radius = 1.5 + Math.random() * 3;
    let color = '#7ca1ff';
    if (d < GALAXY_RADIUS * 0.3) color = '#ffdb6b';

    world.addBody(
      new Body({
        position: pos,
        velocity: vel,
        mass: massFromRadius(radius),
        radius: radius,
        color: color,
      })
    );
  }

  configureCameraForSeed(renderer, { center: new Vec2(0, 0), zoom: 0.15 });
}
