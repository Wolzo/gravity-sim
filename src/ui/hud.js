const SPEED_VALUES = [0.5, 1, 2, 5];

export function initHud(renderer, seeds, defaultSeedKey) {
    const simulation = renderer.simulation;

    let running = true;
    let timeScale = 1;

    let fps = 0;
    let frameCount = 0;
    let fpsTimer = 0;

    let currentSeedKey = defaultSeedKey;

    const btnToggle = document.getElementById("btn-toggle");
    const iconToggle = document.getElementById("icon-toggle");
    const btnReset = document.getElementById("btn-reset");

    const fpsCounter = document.getElementById("fps-counter");
    const bodiesCounter = document.getElementById("bodies-counter");
    const collisionCounter = document.getElementById("collision-counter");

    const speedSlider = document.getElementById("speed-slider");
    const hudSpeedValue = document.getElementById("hud-speed-value");

    const seedSelect = document.getElementById("seed-select");

    btnToggle.addEventListener("click", () => toggleRunning());

    btnReset.addEventListener("click", () => {
        const seed = seeds[currentSeedKey];
        if (seed && typeof seed.apply === "function") {
            seed.apply(renderer);
        }

        simulation.collisionCount = 0;
    });

    if (speedSlider) {
        speedSlider.addEventListener("input", () => {
            const idx = Number(speedSlider.value);
            timeScale = SPEED_VALUES[idx] ?? 1;

            if (hudSpeedValue) {
                hudSpeedValue.textContent = timeScale.toString();
            }
        });
    }

    if (seedSelect) {
        seedSelect.innerHTML = "";

        Object.entries(seeds).forEach(([key, cfg]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = cfg.label ?? key;
            seedSelect.appendChild(opt);
        });

        seedSelect.value = currentSeedKey;

        seedSelect.addEventListener("change", () => {
            currentSeedKey = seedSelect.value;
            const seed = seeds[currentSeedKey];
            if (seed && typeof seed.apply === "function") {
                seed.apply(renderer);
            }
        });
    }

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
    }

    function toggleRunning(disableHud = false) {
        running = !running;

        btnToggle.disabled = disableHud;
        btnReset.disabled = disableHud;
        speedSlider.disabled = disableHud;
        seedSelect.disabled = disableHud;

        if (running) {
            iconToggle.setAttribute("d", "M6 19h4V5H6zm8-14v14h4V5h-4z");
        } else {
            iconToggle.setAttribute("d", "M8 5v14l11-7z");
        }
    }

    return {
        isRunning: () => running,
        getTimeScale: () => timeScale,
        toggleRunning,
        updateHud
    };
}
