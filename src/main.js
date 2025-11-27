import { Simulation } from './core/simulation.js';
import { FIXED_TIME_STEP } from './core/config.js';
import { Renderer } from './render/renderer.js';
import { initHud } from './ui/hud.js';
import { SEEDS, DEFAULT_SEED_KEY } from './seeds/index.js';
import { CreationController } from './core/creations.js';
import { Camera } from './core/camera.js';
import { Vec2 } from './core/vector2.js';
import { QuadTree } from './core/quadtree.js';

const canvas = document.getElementById('simCanvas');

/**
 * Entry point:
 * - creates simulation, camera, renderer, HUD and creation controller
 * - applies the default seed
 * - starts the main loop.
 */

Vec2.warmup(20000);
QuadTree.warmup(20000);

const simulation = new Simulation();
const camera = new Camera();
const renderer = new Renderer(canvas, simulation, camera);

if (typeof window !== 'undefined') {
  window.simulation = simulation;
  window.renderer = renderer;
  window.camera = camera;
}

window.addEventListener('resize', () => renderer.resize());

SEEDS[DEFAULT_SEED_KEY].apply(renderer);

const hud = initHud(renderer, SEEDS, DEFAULT_SEED_KEY);
const hudElement = document.getElementById('hud');

const creation = new CreationController(simulation, canvas, hud, camera, hudElement, (body) => {
  camera.setFollowTarget(body);
  hud.setSelectedBody(body);
  renderer.setSelectedBody(body);
});

/**
 * Main animation loop using a fixed time step:
 * - Accumulates elapsed real time.
 * - Steps the simulation in fixed increments (FIXED_TIME_STEP) for deterministic physics.
 * - Updates camera follow logic.
 * - Renders the scene.
 * - Updates the HUD metrics.
 */
let lastTime = performance.now();
let accumulator = 0;

function loop(now) {
  let rawDt = (now - lastTime) / 1000;
  if (rawDt > 0.25) rawDt = 0.25;

  lastTime = now;

  accumulator += rawDt * hud.getTimeScale();

  const t1 = performance.now();

  let steps = 0;
  while (accumulator >= FIXED_TIME_STEP && steps < 2) {
    if (hud.isRunning()) {
      simulation.step(FIXED_TIME_STEP);
    }

    accumulator -= FIXED_TIME_STEP;
    steps++;
  }

  const t2 = performance.now();

  if (steps >= 2) {
    accumulator = 0;
  }

  if (camera.followTarget) {
    const rect = canvas.getBoundingClientRect();
    const zoom = camera.zoom || 1;
    camera.position.x = camera.followTarget.position.x - rect.width / (2 * zoom);
    camera.position.y = camera.followTarget.position.y - rect.height / (2 * zoom);
  }

  renderer.draw();

  const t3 = performance.now();

  creation.drawPreview();

  const t4 = performance.now();

  hud.updateHud(rawDt);

  const t5 = performance.now();

  /*if (Math.random() < 0.1) {
    console.log(
      `Physics: ${(t2 - t1).toFixed(2)}ms | Render: ${(t3 - t2).toFixed(2)}ms | Preview: ${(t4 - t3).toFixed(2)}ms | HUD: ${(t5 - t4).toFixed(2)}ms`
    );
  }*/

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
