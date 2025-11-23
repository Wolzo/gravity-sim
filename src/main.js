import { Simulation } from './core/simulation.js';
import { FIXED_TIME_STEP } from './core/config.js';
import { Renderer } from './render/renderer.js';
import { initHud } from './ui/hud.js';
import { SEEDS, DEFAULT_SEED_KEY } from './seeds/index.js';
import { CreationController } from './core/creations.js';
import { Camera } from './core/camera.js';

const canvas = document.getElementById('simCanvas');

/**
 * Entry point:
 * - creates simulation, camera, renderer, HUD and creation controller
 * - applies the default seed
 * - starts the main loop.
 */

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

  let steps = 0;
  while (accumulator >= FIXED_TIME_STEP && steps < 5) {
    if (hud.isRunning()) {
      simulation.step(FIXED_TIME_STEP);
    }

    accumulator -= FIXED_TIME_STEP;
    steps++;
  }

  if (steps >= 5) {
    accumulator = 0;
  }

  if (camera.followTarget) {
    const rect = canvas.getBoundingClientRect();
    const zoom = camera.zoom || 1;
    camera.position.x = camera.followTarget.position.x - rect.width / (2 * zoom);
    camera.position.y = camera.followTarget.position.y - rect.height / (2 * zoom);
  }

  renderer.draw();
  creation.drawPreview();
  hud.updateHud(rawDt);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
