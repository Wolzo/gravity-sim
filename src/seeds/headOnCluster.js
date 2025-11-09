import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { massFromRadius } from '../core/config.js';

export function seedHeadOnClusters(renderer) {
  const simulation = renderer?.simulation;
  const canvas = renderer?.canvas;
  if (!simulation || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  simulation.clear();

  const OFFSET_X = 220;
  const CLUSTER_RADIUS = 80;
  const CLUSTER_COUNT = 40;

  // Left cluster core
  const coreRadiusL = 18;
  const coreMassL = massFromRadius(coreRadiusL);
  const coreL = new Body({
    position: new Vec2(cx - OFFSET_X, cy),
    velocity: new Vec2(24, 0),
    mass: coreMassL,
    radius: coreRadiusL,
    color: '#ff8a6c',
    name: 'Core A',
  });
  simulation.addBody(coreL);

  // Right cluster core
  const coreRadiusR = 20;
  const coreMassR = massFromRadius(coreRadiusR);
  const coreR = new Body({
    position: new Vec2(cx + OFFSET_X, cy),
    velocity: new Vec2(-24, 0),
    mass: coreMassR,
    radius: coreRadiusR,
    color: '#6cc0ff',
    name: 'Core B',
  });
  simulation.addBody(coreR);

  // Helper to spawn satellites around a core
  function spawnClusterAround(core, color, sign) {
    for (let i = 0; i < CLUSTER_COUNT; i++) {
      const angle = 2 * Math.PI * (i / CLUSTER_COUNT) + Math.random() * 0.4;
      const r = CLUSTER_RADIUS * Math.sqrt(Math.random()) * 0.8;

      const x = core.position.x + r * Math.cos(angle);
      const y = core.position.y + r * Math.sin(angle);

      const dirCenter = new Vec2(x - core.position.x, y - core.position.y);
      const len = Math.hypot(dirCenter.x, dirCenter.y) || 1;
      dirCenter.x /= len;
      dirCenter.y /= len;

      const tangent = new Vec2(-dirCenter.y, dirCenter.x);

      const baseSpeed = 18;
      const swirl = 0.4 + 0.6 * Math.random();

      const vx = core.velocity.x + tangent.x * baseSpeed * swirl * sign + (Math.random() - 0.5) * 4;
      const vy = core.velocity.y + tangent.y * baseSpeed * swirl * sign + (Math.random() - 0.5) * 4;

      const radius = 3 + Math.random() * 3;
      const mass = massFromRadius(radius);

      const body = new Body({
        position: new Vec2(x, y),
        velocity: new Vec2(vx, vy),
        mass,
        radius,
        color,
      });

      simulation.addBody(body);
    }
  }

  spawnClusterAround(coreL, '#ffb19a', +1);
  spawnClusterAround(coreR, '#9ad0ff', -1);
}
