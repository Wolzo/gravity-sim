import { Body } from "../core/body.js";
import { Vec2 } from "../core/vector2.js";
import { massFromRadius } from "../core/config.js";


/**
 * Creates a simple binary system with two equal-mass bodies
 * orbiting around their common center.
 * The system is centered on the canvas.
 */
export function seedBinarySystem(renderer) {
  const simulation = renderer?.simulation;
  const canvas = renderer?.canvas;

  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  simulation.clear();

  const RADIUS = 12;
  const MASS = massFromRadius(RADIUS);

  simulation.addBody(
    new Body({
      position: new Vec2(cx - 100, cy),
      velocity: new Vec2(3, -3),
      mass: MASS,
      radius: RADIUS,
      color: "#ff6f4d"
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(cx + 100, cy),
      velocity: new Vec2(-3, 3),
      mass: MASS,
      radius: RADIUS,
      color: "#4da6ff"
    })
  );
}
