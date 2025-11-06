/**
 * Visual test entry point.
 * Wires Simulation + Renderer, seeds a simple Sun/Earth system,
 * runs the requestAnimationFrame loop.
 */

import { Simulation } from "./core/simulation.js";
import { Body } from "./core/body.js";
import { Vec2 } from "./core/vector2.js";
import { MAX_DT } from "./core/config.js";
import { Renderer } from "./render/renderer.js";

/** @type {HTMLCanvasElement|null} */
const canvas = document.getElementById("simCanvas");

if (!canvas) {
  throw new Error("simCanvas element not found in DOM");
}

const simulation = new Simulation();
const renderer = new Renderer(canvas, simulation);

window.addEventListener("resize", () => renderer.resize());

/**
 * Simple Sun + Earth seed.
 */
function seedSolarSystem() {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  const sunMass = 5000;
  const sunRadius = 14;
  const earthMass = 10;
  const earthRadius = 5;
  const distance = 200;

  const G = simulation.G;
  const orbitalSpeed = Math.sqrt((G * sunMass) / distance);

  simulation.addBody(
    new Body({
      position: new Vec2(cx, cy),
      velocity: new Vec2(0, 0),
      mass: sunMass,
      radius: sunRadius,
      color: "#f5d76e"
    })
  );

  simulation.addBody(
    new Body({
      position: new Vec2(cx, cy - distance),
      velocity: new Vec2(orbitalSpeed, 0),
      mass: earthMass,
      radius: earthRadius,
      color: "#4da6ff"
    })
  );
}

seedSolarSystem();

let lastTime = performance.now();

/**
 * Main animation loop.
 * @param {DOMHighResTimeStamp} now
 */
function loop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;

  const dt = Math.min(rawDt, MAX_DT);
  simulation.step(dt);
  renderer.draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
