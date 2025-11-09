import { Simulation } from './core/simulation.js';
import { MAX_DT } from './core/config.js';
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

const creation = new CreationController(simulation, canvas, hud, camera, (body) => {
  camera.setFollowTarget(body);
  hud.setSelectedBody(body);
  renderer.setSelectedBody(body);
});

/**
 * Main animation loop:
 * - computes delta time with a safety cap (MAX_DT)
 * - steps the simulation if running
 * - updates camera follow
 * - renders the scene
 * - updates the HUD.
 */
let lastTime = performance.now();
function loop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;

  const scaledDt = Math.min(rawDt * hud.getTimeScale(), MAX_DT);

  if (hud.isRunning()) {
    simulation.step(scaledDt);
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
