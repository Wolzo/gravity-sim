import { formatValue } from '../utils/utils.js';

const SPEED_VALUES = [0.5, 1, 2, 5];

/**
 * Sets up the HUD (controls + overlay info) for a given renderer and set of seeds:
 * - play / pause toggle
 * - reset current seed
 * - time-scale (speed) slider
 * - seed selector
 * - small tooltip that shows info about the currently selected body.
 */
export function initHud(renderer, seeds, defaultSeedKey) {
  const simulation = renderer.simulation;

  let running = true;
  let timeScale = 1;

  let fps = 0;
  let frameCount = 0;
  let fpsTimer = 0;

  let currentSeedKey = defaultSeedKey;
  let selectedBody = null;

  const btnToggle = document.getElementById('btn-toggle');
  const iconToggle = document.getElementById('icon-toggle');
  const btnReset = document.getElementById('btn-reset');

  const fpsCounter = document.getElementById('fps-counter');
  const bodiesCounter = document.getElementById('bodies-counter');
  const collisionCounter = document.getElementById('collisions-counter');

  const speedSlider = document.getElementById('speed-slider');
  const hudSpeedValue = document.getElementById('hud-speed-value');

  const seedSelect = document.getElementById('seed-select');

  const tooltipEl = document.getElementById('body-tooltip');

  btnToggle.addEventListener('click', () => toggleRunning());

  btnReset.addEventListener('click', () => resetSim());

  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      const idx = Number(speedSlider.value);
      timeScale = SPEED_VALUES[idx] ?? 1;

      if (hudSpeedValue) {
        hudSpeedValue.textContent = timeScale.toString();
      }
    });
  }

  if (seedSelect) {
    seedSelect.innerHTML = '';

    Object.entries(seeds).forEach(([key, cfg]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cfg.label ?? key;
      seedSelect.appendChild(opt);
    });

    seedSelect.value = currentSeedKey;

    seedSelect.addEventListener('change', () => {
      currentSeedKey = seedSelect.value;
      resetSim();
    });
  }

  /**
   * Updates HUD state from the current simulation frame:
   * - FPS counter
   * - body count
   * - collision count
   * - position and content of the body tooltip (if a body is selected).
   */
  function updateHud(rawDt) {
    frameCount++;
    fpsTimer += rawDt;

    if (fpsTimer >= 1) {
      fps = frameCount;
      frameCount = 0;
      fpsTimer = 0;
    }

    if (fpsCounter) {
      fpsCounter.textContent = fps.toString();
    }

    if (bodiesCounter) {
      bodiesCounter.textContent = simulation.bodies.length.toString();
    }

    if (collisionCounter) {
      collisionCounter.textContent = simulation.collisionCount.toString();
    }

    if (tooltipEl) {
      if (selectedBody && renderer.camera) {
        const cam = renderer.camera;
        const canvas = renderer.canvas;

        const rect = canvas.getBoundingClientRect();

        const screenPos = cam.worldToScreen(selectedBody.position.x, selectedBody.position.y);

        const sx = rect.left + screenPos.x;
        const sy = rect.top + screenPos.y;

        if (
          screenPos.x < 0 ||
          screenPos.y < 0 ||
          screenPos.x > rect.width ||
          screenPos.y > rect.height
        ) {
          tooltipEl.style.display = 'none';
        } else {
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = `${sx}px`;
          tooltipEl.style.top = `${sy}px`;

          const name = selectedBody.name || 'Body';
          const mass = selectedBody.mass;
          const vx = selectedBody.velocity.x;
          const vy = selectedBody.velocity.y;
          const speed = Math.sqrt(vx * vx + vy * vy);

          tooltipEl.innerHTML =
            `<strong>${name}</strong><br>` +
            `m = ${formatValue(mass)}<br>` +
            `|v| = ${formatValue(speed)}<br>` +
            `K = ${formatValue(selectedBody.kineticEnergy())}`;
        }
      } else {
        tooltipEl.style.display = 'none';
      }
    }
  }

  /**
   * Sets the currently selected body, whose info is shown in the tooltip.
   * Pass `null` to clear the selection.
   */
  function setSelectedBody(body) {
    selectedBody = body || null;
  }

  /**
   * Toggles the simulation running state and optionally disables HUD controls
   * while the user is interacting (e.g. during body creation).
   */
  function setHudDisabled(disabled) {
    btnToggle.disabled = disabled;
    btnReset.disabled = disabled;
    speedSlider.disabled = disabled;
    seedSelect.disabled = disabled;
  }

  function setRunning(value) {
    running = value;

    if (running) {
      iconToggle.setAttribute('d', 'M6 19h4V5H6zm8-14v14h4V5h-4z');
    } else {
      iconToggle.setAttribute('d', 'M8 5v14l11-7z');
    }
  }

  function toggleRunning() {
    setRunning(!running);
  }

  /**
   * Clears the current focus/selection:
   * - hides the tooltip
   * - stops the camera from following any body.
   */
  function resetFocus() {
    selectedBody = null;
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
    }

    if (renderer.camera && typeof renderer.camera.setFollowTarget === 'function') {
      renderer.camera.setFollowTarget(null);
    }
  }

  function resetSim() {
    const seed = seeds[currentSeedKey];
    if (seed && typeof seed.apply === 'function') {
      seed.apply(renderer);
    }

    resetFocus();
  }

  return {
    isRunning: () => running,
    getTimeScale: () => timeScale,
    toggleRunning,
    setRunning,
    setHudDisabled,
    updateHud,
    setSelectedBody,
    resetSim,
  };
}
