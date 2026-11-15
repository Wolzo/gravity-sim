# gravity-sim

An interactive 2D N-body gravity simulator running on HTML5 Canvas, with Barnes-Hut
gravity, inelastic collisions, merging and fragmentation.

## Running

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

Other scripts:

| Script                 | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run build`        | Production bundle into `dist/`    |
| `npm run preview`      | Serve the built bundle            |
| `npm test`             | Run the physics test suite once   |
| `npm run test:watch`   | Run the suite in watch mode       |
| `npm run format`       | Format with Prettier              |
| `npm run format:check` | Verify formatting without writing |

A bundler is required, not optional: `DebrisGenerator` imports `delaunator` as a bare
module specifier, which browsers cannot resolve on their own. Opening `index.html` from
the filesystem or serving `src/` with a static file server will fail to load.

## Controls

**Mouse**

| Input                | Action                                                         |
| -------------------- | -------------------------------------------------------------- |
| Left click on a body | Select it; the camera follows it and a tooltip shows its stats |
| Left click on empty  | Start creating a body — drag to size it                        |
| Left click again     | Confirm the radius, then drag to aim its velocity              |
| Left click a third   | Release the body into the simulation                           |
| Right click + drag   | Pan the camera                                                 |
| Right click          | Cancel an in-progress body creation                            |
| Wheel                | Zoom toward the cursor                                         |

Creating a body pauses the simulation; it resumes when you finish or cancel.

**Keyboard**

| Key                 | Action                     |
| ------------------- | -------------------------- |
| `Space`             | Play / pause               |
| `R`                 | Reset the current scenario |
| `Esc`               | Cancel body creation       |
| `Del` / `Backspace` | Delete the selected body   |
| `W` `A` `S` `D`     | Pan the camera             |
| Arrow keys          | Pan the camera             |
| `+` / `-`           | Zoom in / out              |

## Scenarios

Picked from the dropdown in the HUD, defined in `src/client/seeds/`:

- **Solar System** — the eight planets on softened circular orbits, plus an asteroid belt
- **Spiral Galaxy** — 600 stars in three arms around a central mass
- **Binary Star & Disk** — two equal stars with a wide circumbinary disk
- **Galactic Collision** — two counter-rotating clusters on a collision course
- **Kessler Syndrome** — five counter-orbiting satellite shells; a collision cascade

## Architecture

```
src/
  main.js                  Composition root: wiring, fixed-step loop
  bridge/EventBus.js       Pub/sub; the only channel between engine, render and UI
  engine/                  DOM-free physics core
    World.js               Pipeline orchestration, collision broad phase, bookkeeping
    Body.js                Body state
    Trail.js               Fixed-capacity ring buffer of trail points
    systems/Dynamics.js    Velocity Verlet integration, gravity dispatch
    systems/QuadTree.js    Barnes-Hut tree: gravity approximation + range queries
    systems/CollisionResolver.js  Merge / fragment outcomes
    logic/DebrisGenerator.js      Delaunay shard shapes for debris
  client/                  Everything that touches the DOM
    graphics/Renderer.js   Canvas2D draw pipeline
    graphics/GlowSprites.js  Pre-rendered glow textures, cached per colour
    graphics/StarBackground.js  Pre-rendered parallax starfield tile
    graphics/Camera.js     Pan / zoom / follow, screen<->world transforms
    input/CreationController.js  Mouse and keyboard
    ui/HUD.js              Counters, speed slider, tooltip
    seeds/                 Scenario definitions
  shared/                  Used by both sides
    config/                Tunable physics and render constants
    math/                  Vec2 (pooled), scalar helpers
    utils/                 Colour palettes, name generation
```

The engine never touches the DOM and communicates only through the event bus, so it can
be tested in plain Node — and could be moved to a Web Worker without changing the client.

### Simulation loop

`main.js` runs a fixed `1/60 s` physics step decoupled from rendering, with an
accumulator capped at `MAX_STEPS_PER_FRAME` steps. The cap matters: without it, any time
scale demanding more steps than a frame can afford grows the backlog without bound, and
the simulation keeps running fast long after the speed slider is turned down.

### Gravity

Barnes-Hut on a quadtree, O(N log N). A node is approximated by its centre of mass when
`size / distance < THETA`. `THETA` must stay below `1/sqrt(2)`, otherwise a node
_containing_ the body being evaluated could pass the test and the body would attract
itself; `QuadTree.setTheta` clamps it. At `MAX_DEPTH` bodies that cannot be separated are
kept in a per-leaf overflow list, so they remain visible to range queries and their own
contribution can be excluded exactly.

## Known non-conservation

Two deliberate trade-offs mean the simulation is not strictly conservative, both visible
in the HUD or documented in `PhysicsConfig.js`:

- **Momentum drifts.** Bodies below `MIN_GRAVITY_MASS` feel gravity without exerting it,
  which breaks Newton's third law. Set it to `0` for a symmetric — and much slower — run.
- **Mass is destroyed.** Impacts above `VAPORIZE_THRESHOLD` annihilate both bodies,
  sub-pixel fragments are discarded, and bodies beyond `MAX_BODIES` are dropped. The
  running total is shown as _Lost mass_ in the HUD.

Barnes-Hut itself is also asymmetric — the force A computes for B need not equal the one
B computes for A — so momentum is only exactly conserved when the traversal resolves to
individual leaves.

## Tests

`npm test` runs the suite in `tests/`, covering physics invariants rather than rendering:
momentum conservation for an isolated pair, a circular orbit held over a full period,
Barnes-Hut against a brute-force O(N²) reference, self-attraction, the `MAX_DEPTH`
overflow path, trail ring-buffer semantics, mass accounting, and the collision cooldown
that stops fragments from cascading.
