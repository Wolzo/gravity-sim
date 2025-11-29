import { Body } from '../../engine/Body.js';
import { Vec2 } from '../../shared/math/Vec2.js';
import { configureCameraForSeed } from '../../shared/utils/CameraUtils.js';
import { massFromRadius, radiusFromMass, PHYSICS } from '../../shared/config/PhysicsConfig.js';

export function seedSolarSystem({ world, renderer }) {
  if (!world) return;
  world.clear();

  const G = PHYSICS.GRAVITY_CONSTANT;
  const EARTH_MASS = 30 * 30 * PHYSICS.DENSITY_2D;
  const SUN_MASS = EARTH_MASS * 3000;
  const ORBIT_SCALE = 3500;

  world.addBody(
    new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(0, 0),
      mass: SUN_MASS,
      radius: radiusFromMass(SUN_MASS),
      color: '#ffdd88',
      name: 'Sun',
    })
  );

  const planets = [
    { name: 'Mercury', a: 0.39, m: 0.055, c: '#a67d5d' },
    { name: 'Venus', a: 0.72, m: 0.815, c: '#e3bb76' },
    { name: 'Earth', a: 1.0, m: 1.0, c: '#466d9d' },
    { name: 'Mars', a: 1.52, m: 0.11, c: '#d14a28' },
    { name: 'Jupiter', a: 5.2, m: 317.8, c: '#d9c496' },
    { name: 'Saturn', a: 9.5, m: 95.2, c: '#eaddb6' },
    { name: 'Uranus', a: 19.2, m: 14.5, c: '#9ad9ff' },
    { name: 'Neptune', a: 30.1, m: 17.1, c: '#3e54e8' },
  ];

  planets.forEach((p) => {
    const r = p.a * ORBIT_SCALE;
    const angle = Math.random() * Math.PI * 2;
    const pos = new Vec2(r * Math.cos(angle), r * Math.sin(angle));

    const vMag = Math.sqrt((G * SUN_MASS) / r);
    const vel = new Vec2(-Math.sin(angle) * vMag, Math.cos(angle) * vMag);
    const mass = EARTH_MASS * p.m;

    world.addBody(
      new Body({
        position: pos,
        velocity: vel,
        mass,
        radius: radiusFromMass(mass),
        color: p.c,
        name: p.name,
      })
    );
  });

  const BELT_COUNT = 150;
  for (let i = 0; i < BELT_COUNT; i++) {
    const dist = (2.2 + Math.random() * 1.0) * ORBIT_SCALE;
    const angle = Math.random() * Math.PI * 2;
    const pos = new Vec2(dist * Math.cos(angle), dist * Math.sin(angle));

    const vMag = Math.sqrt((G * SUN_MASS) / dist);
    const vel = new Vec2(-Math.sin(angle) * vMag, Math.cos(angle) * vMag);

    const r = 1.5 + Math.random() * 2;
    world.addBody(
      new Body({
        position: pos,
        velocity: vel,
        mass: massFromRadius(r),
        radius: r,
        color: '#6b6b6b',
      })
    );
  }

  configureCameraForSeed(renderer, { center: new Vec2(0, 0), zoom: 0.12 });
}
