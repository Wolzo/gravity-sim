import { EventBus } from './bridge/EventBus.js';
import { World } from './engine/World.js';
import { Renderer } from './client/graphics/Renderer.js';
import { Camera } from './client/graphics/Camera.js';
import { CreationController } from './client/input/CreationController.js';
import { HUD } from './client/ui/HUD.js';
import { PHYSICS } from './shared/config/PhysicsConfig.js';
import { SEEDS, DEFAULT_SEED_KEY } from './client/seeds/Seeds.js';

const canvas = document.getElementById('simCanvas');
const hudElement = document.getElementById('hud');

const eventBus = new EventBus();
const world = new World(eventBus);
const camera = new Camera(eventBus);
const renderer = new Renderer(canvas, eventBus);
const creationController = new CreationController(canvas, eventBus, hudElement);
const hud = new HUD(eventBus, SEEDS, DEFAULT_SEED_KEY);

if (typeof window !== 'undefined') {
  window.world = world;
  window.renderer = renderer;
  window.camera = camera;
}

window.addEventListener('load', () => eventBus.emit('window:resize', window.visualViewport));
window.addEventListener('resize', () => eventBus.emit('window:resize', window.visualViewport));

if (SEEDS[DEFAULT_SEED_KEY]) {
  SEEDS[DEFAULT_SEED_KEY].apply({ eventBus });
}

eventBus.on('ui:reset', (seedKey) => {
  const seed = SEEDS[seedKey];
  if (seed && typeof seed.apply === 'function') {
    seed.apply({ eventBus });
  }
});

let lastTime = performance.now();
let accumulator = 0;
const FIXED_STEP = PHYSICS.FIXED_TIME_STEP;

let isRunning = true;
let wasRunningBeforePause = false;
let timeScale = 1;

eventBus.on('sim:toggle', () => {
  isRunning = !isRunning;
  eventBus.emit(isRunning ? 'ui:resume' : 'ui:pause');
});

eventBus.on('sim:pause', () => {
  wasRunningBeforePause = isRunning;
  isRunning = false;
  eventBus.emit('ui:pause');
});

eventBus.on('sim:resume', (resumeOldState) => {
  if (resumeOldState && !wasRunningBeforePause) return;

  isRunning = true;
  eventBus.emit('ui:resume');
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

  eventBus.emit('frame:render', {
    dt: dt,
    camPos: camera.position,
    camZoom: camera.zoom,
    viewport: camera.viewport,
    bodies: world.bodies,
    fadingTrails: world.fadingTrails,
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
