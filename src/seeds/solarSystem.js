import { Body } from "../core/body.js";
import { Vec2 } from "../core/vector2.js";
import { radiusFromMass } from "../core/config.js";

/**
 * Creates a simulation of the solar system with the Sun and major planets
 * The system is centered on the canvas.
 * Masses and distances are scaled for better visualization and to avoid collisions.
 */
export function seedSolarSystem(renderer) {
  const simulation = renderer?.simulation;
  const canvas = renderer?.canvas;

  if (!simulation || !canvas) return;

  simulation.clear();

  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  const EARTH_MASS_BASE = 1e-6;

  const SUN_MASS_REL = 333000;
  const SUN_MASS = EARTH_MASS_BASE * SUN_MASS_REL;

  const VISUAL_RADIUS_SCALE = 40;
  const MIN_RADIUS = 2;
  const MAX_RADIUS = 26;

  const MAX_SEMI_MAJOR_AU = 30;
  const DIST_SCALE =
    (Math.min(rect.width, rect.height) * 0.4) /
    Math.sqrt(MAX_SEMI_MAJOR_AU);

  const G =
    typeof simulation.G === "number"
      ? simulation.G
      : GRAVITY_CONSTANT;

  const planets = [
    { name: "Mercury", aAU: 0.39, massRel: 0.055,  color: "#c2b28f" },
    { name: "Venus",   aAU: 0.72, massRel: 0.815,  color: "#e0c896" },
    { name: "Earth",   aAU: 1.00, massRel: 1.000,  color: "#6fa8ff" },
    { name: "Mars",    aAU: 1.52, massRel: 0.107,  color: "#ff7043" },
    { name: "Jupiter", aAU: 5.20, massRel: 317.8,  color: "#f2d1a0" },
    { name: "Saturn",  aAU: 9.58, massRel: 95.20,  color: "#f5e2b8" },
    { name: "Uranus",  aAU: 19.2, massRel: 14.50,  color: "#9ad9ff" },
    { name: "Neptune", aAU: 30.1, massRel: 17.10,  color: "#5b8cff" }
  ];

  const sunRadiusBase = radiusFromMass(SUN_MASS) * VISUAL_RADIUS_SCALE;
  const sunRadius = Math.min(40, Math.max(10, sunRadiusBase));

  simulation.addBody(
    new Body({
      position: new Vec2(cx, cy),
      velocity: new Vec2(0, 0),
      mass: SUN_MASS,
      radius: sunRadius,
      color: "#ffdd88"
    })
  );

  for (const p of planets) {
    const distance = Math.sqrt(p.aAU) * DIST_SCALE;

    const angle = Math.random() * Math.PI * 2;

    const x = cx + distance * Math.cos(angle);
    const y = cy + distance * Math.sin(angle);

    const orbitalSpeed = Math.sqrt((G * SUN_MASS) / distance);
    const vx = -orbitalSpeed * Math.sin(angle);
    const vy =  orbitalSpeed * Math.cos(angle);

    const mass = EARTH_MASS_BASE * p.massRel;

    const radiusBase = radiusFromMass(mass) * VISUAL_RADIUS_SCALE;
    const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radiusBase));

    simulation.addBody(
      new Body({
        position: new Vec2(x, y),
        velocity: new Vec2(vx, vy),
        mass,
        radius,
        color: p.color
      })
    );
  }
}
