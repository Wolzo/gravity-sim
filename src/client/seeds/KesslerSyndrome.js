import { Body } from '../../engine/Body.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { configureCameraForSeed } from '../../shared/utils/CameraUtils.js';
import { massFromRadius, PHYSICS } from '../../shared/config/PhysicsConfig.js';

export function seedKesslerSyndrome({ world, eventBus }) {
  if (!world) return;
  world.clear();

  const G = PHYSICS.GRAVITY_CONSTANT;
  const PLANET_RADIUS = 60;
  const PLANET_MASS = massFromRadius(PLANET_RADIUS) * 5;

  world.addBody(
    new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(0, 0),
      mass: PLANET_MASS,
      radius: PLANET_RADIUS,
      color: '#466d9d',
      name: 'Earth',
    })
  );

  const LAYERS = 5;
  const BODIES_PER_LAYER = 60;
  const BASE_R = 150;

  for (let layer = 0; layer < LAYERS; layer++) {
    const r = BASE_R + layer * 40;
    const cw = layer % 2 === 0;
    const dir = cw ? 1 : -1;
    const color = cw ? '#ffffff' : '#ff4444';

    for (let i = 0; i < BODIES_PER_LAYER; i++) {
      const angle = (i / BODIES_PER_LAYER) * Math.PI * 2 + Math.random() * 0.1;
      const pos = new Vec2(r * Math.cos(angle), r * Math.sin(angle));
      const vMag = Math.sqrt((G * PLANET_MASS) / r);
      const vel = new Vec2(-Math.sin(angle) * vMag * dir, Math.cos(angle) * vMag * dir);

      world.addBody(
        new Body({
          position: pos,
          velocity: vel,
          mass: massFromRadius(2),
          radius: 2,
          color: color,
          name: 'Sat',
        })
      );
    }
  }

  eventBus.emit('camera:set-position', { dx: 0, dy: 0, zoom: 0.8 });
}
