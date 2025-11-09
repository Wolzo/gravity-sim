import { Body } from '../core/body.js';
import { Vec2 } from '../core/vector2.js';
import { radiusFromMass, massFromRadius, GRAVITY_CONSTANT } from '../core/config.js';
import { configureCameraForSeed } from '../utils/utils.js';

/**
 * Initializes a semi-realistic solar system:
 * - Sun at the origin
 * - planet distances scaled from their semi-major axes in AU
 * - masses proportional to real mass ratios
 * - radius derived from mass using the same mass–radius law as user-created bodies.
 * Uses the simulation's G to compute circular orbital velocities.
 */
export function seedSolarSystem(renderer) {
  const simulation = renderer?.simulation;
  if (!simulation) return;

  simulation.clear();

  const EARTH_RADIUS = 30;
  const EARTH_MASS = massFromRadius(EARTH_RADIUS);

  const SUN_MASS_FACTOR = 1000;
  const SUN_MASS = EARTH_MASS * SUN_MASS_FACTOR;

  const ORBIT_SCALE = 3000;

  const G = typeof simulation.G === 'number' ? simulation.G : GRAVITY_CONSTANT;

  const planets = [
    { name: 'Mercury', aAU: 0.39, massRel: 0.055, color: '#c2b28f' },
    { name: 'Venus', aAU: 0.72, massRel: 0.815, color: '#e0c896' },
    { name: 'Earth', aAU: 1.0, massRel: 1.0, color: '#6fa8ff' },
    { name: 'Mars', aAU: 1.52, massRel: 0.107, color: '#ff7043' },
    { name: 'Jupiter', aAU: 5.2, massRel: 317.8, color: '#f2d1a0' },
    { name: 'Saturn', aAU: 9.58, massRel: 95.2, color: '#f5e2b8' },
    { name: 'Uranus', aAU: 19.2, massRel: 14.5, color: '#9ad9ff' },
    { name: 'Neptune', aAU: 30.1, massRel: 17.1, color: '#5b8cff' },
  ];

  const sunRadius = radiusFromMass(SUN_MASS);

  simulation.addBody(
    new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(0, 0),
      mass: SUN_MASS,
      radius: sunRadius,
      color: '#ffdd88',
      name: 'Sun',
    })
  );

  for (const p of planets) {
    const distance = p.aAU * ORBIT_SCALE;

    const angle = Math.random() * Math.PI * 2;
    const x = distance * Math.cos(angle);
    const y = distance * Math.sin(angle);

    const orbitalSpeed = Math.sqrt((G * SUN_MASS) / distance);
    const vx = -orbitalSpeed * Math.sin(angle);
    const vy = orbitalSpeed * Math.cos(angle);

    const mass = EARTH_MASS * p.massRel;

    const radius = radiusFromMass(mass);

    simulation.addBody(
      new Body({
        position: new Vec2(x, y),
        velocity: new Vec2(vx, vy),
        mass,
        radius,
        color: p.color,
        name: p.name,
      })
    );
  }

  configureCameraForSeed(renderer, {
    center: new Vec2(0, 0),
    zoom: 0.15,
  });
}
