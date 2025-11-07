import { Body } from "../core/body.js";
import { Vec2 } from "../core/vector2.js";

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

  simulation.addBody(
    new Body({
      position: new Vec2(cx - 100, cy),
      velocity: new Vec2(10, 10),
      mass: 1000,
      radius: 12,
      color: "#ff6f4d"
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(cx + 100, cy),
      velocity: new Vec2(-10, -10),
      mass: 1000,
      radius: 12,
      color: "#4da6ff"
    })
  );
}
