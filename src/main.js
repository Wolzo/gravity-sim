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
  window.creationController = creationController;
  window.hud = hud;
}

/**
 * The canvas is the single source of truth for the viewport: the Camera needs the same
 * dimensions the Renderer draws with, or screen-to-world picking drifts.
 */
function emitViewport() {
  const rect = canvas.getBoundingClientRect();
  eventBus.emit('window:resize', { width: rect.width, height: rect.height });
}

window.addEventListener('resize', emitViewport);
// Emitted synchronously as well: if the module runs after `load` has already fired,
// a load-only listener would never run and the camera would keep a 0x0 viewport.
emitViewport();

if (SEEDS[DEFAULT_SEED_KEY]) {
  SEEDS[DEFAULT_SEED_KEY].apply({ eventBus });
}

eventBus.on('ui:reset', (seedKey) => {
  const seed = SEEDS[seedKey];
  if (seed && typeof seed.apply === 'function') {
    seed.apply({ eventBus });
  }
});

const FIXED_STEP = PHYSICS.FIXED_TIME_STEP;
const MAX_STEPS = PHYSICS.MAX_STEPS_PER_FRAME;
const MAX_BACKLOG = FIXED_STEP * MAX_STEPS;

let lastTime = performance.now();
let accumulator = 0;

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

  if (isRunning) {
    accumulator += dt * timeScale;

    // Hard cap on the backlog. Without it, any timeScale demanding more than
    // MAX_STEPS per frame grows the accumulator without bound: the simulation stays
    // pinned at MAX_STEPS x realtime and then keeps running fast for minutes after the
    // speed slider is turned back down, while it drains the arrears.
    if (accumulator > MAX_BACKLOG) {
      accumulator = MAX_BACKLOG;
    }

    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      world.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps++;
    }
  } else {
    // Do not bank time while paused.
    accumulator = 0;
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
