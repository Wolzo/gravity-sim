import { Body } from "../core/body.js";
import { Vec2 } from "../core/vector2.js";

/**
 * Creates a simulation of the solar system with the Sun and major planets
 * The system is centered on the canvas.
 * Masses and distances are scaled for better visualization and to avoid collisions.
 */
export function seedSolarSystem(renderer) {
  const simulation = renderer?.simulation;
  const canvas = renderer?.canvas;

  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  simulation.clear();

  const RADIUS_SCALE = 1.5;

  const SUN_MASS = 5000;
  const SUN_RADIUS = 10;
  const G = simulation.G;

  simulation.addBody(
    new Body({
      position: new Vec2(cx, cy),
      velocity: new Vec2(0, 0),
      mass: SUN_MASS,
      radius: SUN_RADIUS * RADIUS_SCALE,
      color: "#f5d76e"
    })
  );

  const planets = [
    { name: "Mercury", aAU: 0.39, radiusPlanet: 0.383, color: "#c2b19f" },
    { name: "Venus", aAU: 0.72, radiusPlanet: 0.949, color: "#f5c06d" },
    { name: "Earth", aAU: 1.00, radiusPlanet: 1.000, color: "#4da6ff" },
    { name: "Mars", aAU: 1.52, radiusPlanet: 0.532, color: "#ff6f4d" },
    { name: "Jupiter", aAU: 5.20, radiusPlanet: 11.20, color: "#f0d9b5" },
    { name: "Saturn", aAU: 9.58, radiusPlanet: 9.450, color: "#f8e3b0" },
    { name: "Uranus", aAU: 19.2, radiusPlanet: 4.010, color: "#9be7ff" },
    { name: "Neptune", aAU: 30.1, radiusPlanet: 3.880, color: "#4f7dff" }
  ];

  const DIST_SCALE = 80;
  const BASE_RADIUS = 4;
  const PLANET_MASS = 0.01;

  for (const p of planets) {
    const distance = DIST_SCALE * Math.sqrt(p.aAU);

    const angle = Math.random() * Math.PI * 2;

    const x = cx + distance * Math.cos(angle);
    const y = cy + distance * Math.sin(angle);

    const orbitalSpeed = Math.sqrt((G * SUN_MASS) / distance);

    const vx = -orbitalSpeed * Math.sin(angle);
    const vy = orbitalSpeed * Math.cos(angle);

    const radius = BASE_RADIUS * RADIUS_SCALE * Math.cbrt(p.radiusPlanet);

    simulation.addBody(
      new Body({
        position: new Vec2(x, y),
        velocity: new Vec2(vx, vy),
        mass: PLANET_MASS,
        radius,
        color: p.color
      })
    );
  }
}
