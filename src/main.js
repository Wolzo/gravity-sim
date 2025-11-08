import { Simulation } from './core/simulation.js';
import { MAX_DT } from './core/config.js';
import { Renderer } from './render/renderer.js';
import { initHud } from './ui/hud.js';
import { SEEDS, DEFAULT_SEED_KEY } from './seeds/index.js';
import { CreationController } from './core/creations.js';
import { Camera } from './core/camera.js';

const canvas = document.getElementById('simCanvas');

const simulation = new Simulation();
const camera = new Camera();
const renderer = new Renderer(canvas, simulation, camera);

window.addEventListener('resize', () => renderer.resize());

SEEDS[DEFAULT_SEED_KEY].apply(renderer);

const hud = initHud(renderer, SEEDS, DEFAULT_SEED_KEY);

const creation = new CreationController(simulation, canvas, hud, camera);

let lastTime = performance.now();
function loop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;

  const dt = Math.min(rawDt, MAX_DT);
  const scaledDt = dt * hud.getTimeScale();

  if (hud.isRunning()) {
    simulation.step(scaledDt);
  }

  renderer.draw();
  creation.drawPreview();
  hud.updateHud(rawDt);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
