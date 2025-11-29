import { EventBus } from './bridge/EventBus.js';
import { World } from './engine/World.js';
import { Renderer } from './client/graphics/Renderer.js';
import { Camera } from './client/graphics/Camera.js';
import { CreationController } from './client/input/CreationController.js';
import { HUD } from './client/ui/HUD.js';
import { PHYSICS } from './shared/config/PhysicsConfig.js';
import { SEEDS, DEFAULT_SEED_KEY } from './client/seeds/Seeds.js';

const canvas = document.getElementById('simCanvas');

const eventBus = new EventBus();
const world = new World(eventBus);
const camera = new Camera(eventBus);
const renderer = new Renderer(canvas, world, camera, eventBus);
const creationController = new CreationController(canvas, world, camera, eventBus);
const hud = new HUD(renderer, eventBus, SEEDS, DEFAULT_SEED_KEY);

if (typeof window !== 'undefined') {
  window.world = world;
  window.renderer = renderer;
  window.camera = camera;
}

window.addEventListener('resize', () => renderer.resize());

if (SEEDS[DEFAULT_SEED_KEY]) {
  SEEDS[DEFAULT_SEED_KEY].apply({ world, renderer, eventBus });
}

eventBus.on('ui:reset', (seedKey) => {
  const seed = SEEDS[seedKey];
  if (seed && typeof seed.apply === 'function') {
    seed.apply({ world, renderer, eventBus });
  }

  camera.setFollowTarget(null);
});

let lastTime = performance.now();
let accumulator = 0;
const FIXED_STEP = PHYSICS.FIXED_TIME_STEP;

let isRunning = true;
let timeScale = 1;

eventBus.on('ui:toggle', () => {
  isRunning = !isRunning;
  eventBus.emit(isRunning ? 'ui:resume' : 'ui:pause');
});

eventBus.on('ui:timeScale', (scale) => {
  timeScale = scale;
});

function loop(now) {
  let dt = (now - lastTime) / 1000;
  if (dt > 0.25) {
    dt = 0.25;
  }
  lastTime = now;

  accumulator += dt * timeScale;

  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 2) {
    if (isRunning) {
      world.step(FIXED_STEP);
    }

    accumulator -= FIXED_STEP;
    steps++;
  }

  if (camera.followTarget) {
    const rect = canvas.getBoundingClientRect();
    const zoom = camera.zoom || 1;
    camera.position.x = camera.followTarget.position.x - rect.width / (2 * zoom);
    camera.position.y = camera.followTarget.position.y - rect.height / (2 * zoom);
  }

  eventBus.emit('frame:render', dt);

  renderer.draw(dt);
  creationController.drawPreview();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
