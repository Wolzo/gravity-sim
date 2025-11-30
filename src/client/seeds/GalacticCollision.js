import { Body } from '../../engine/Body.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { configureCameraForSeed } from '../../shared/utils/CameraUtils.js';
import { massFromRadius, PHYSICS } from '../../shared/config/PhysicsConfig.js';

export function seedGalacticCollision({ world, eventBus }) {
  if (!world) return;
  world.clear();

  const G = PHYSICS.GRAVITY_CONSTANT;

  function spawnCluster(centerX, centerY, velocityX, velocityY, colorTheme, rotateCW) {
    const CORE_MASS = 15000;
    const COUNT = 250;
    const RADIUS = 600;

    world.addBody(
      new Body({
        position: new Vec2(centerX, centerY),
        velocity: new Vec2(velocityX, velocityY),
        mass: CORE_MASS,
        radius: 30,
        color: '#ffffff',
      })
    );

    for (let i = 0; i < COUNT; i++) {
      const r = 40 + Math.random() * RADIUS;
      const theta = Math.random() * Math.PI * 2;

      const localPos = new Vec2(r * Math.cos(theta), r * Math.sin(theta));
      const vOrbital = Math.sqrt((G * CORE_MASS) / r);

      const dir = rotateCW ? 1 : -1;
      const localVel = new Vec2(
        -Math.sin(theta) * vOrbital * dir,
        Math.cos(theta) * vOrbital * dir
      );

      world.addBody(
        new Body({
          position: new Vec2(centerX + localPos.x, centerY + localPos.y),
          velocity: new Vec2(velocityX + localVel.x, velocityY + localVel.y),
          mass: massFromRadius(3),
          radius: 2 + Math.random(),
          color: colorTheme,
        })
      );
    }
  }

  spawnCluster(-1000, 0, 15, 0, '#ffaa88', true);
  spawnCluster(1000, 200, -15, 0, '#88aaff', false);

  eventBus.emit('camera:set-position', { dx: 0, dy: 0, zoom: 0.25 });
}
