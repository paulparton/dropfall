# Coding Conventions

**Analysis Date:** 2026-03-19

## Module System

**Format:** ES modules throughout (`type: "module"` in `package.json`).

**Imports are always explicit named or namespace:**
```js
import * as THREE from 'three';
import { useGameStore } from './store.js';
import { initPhysics, updatePhysics } from './physics.js';
import { Player } from './entities/Player.js';
```

**All imports include `.js` extension** — required for native ES module resolution with Vite.

**Dynamic imports** are used for deferred/settings-triggered loads:
```js
import('./audio.js').then(module => { module.setMusicVolume(val); });
import('./renderer.js').then(module => { /* update bloom */ });
```

**No barrel files** — each module is imported directly by path.

## Naming Patterns

**Files:**
- Modules: `camelCase.js` — `src/main.js`, `src/renderer.js`, `src/physics.js`, `src/store.js`
- Entity classes: `PascalCase.js` — `src/entities/Player.js`, `src/entities/Arena.js`
- Utility modules: `camelCase.js` — `src/utils/math.js`, `src/utils/themeTextures.js`

**Functions:**
- `camelCase` — `initRenderer()`, `updatePhysics()`, `getPresetsFromStorage()`
- Init functions prefixed with `init` — `initRenderer`, `initPhysics`, `initAudio`, `initInput`
- Update functions prefixed with `update` — `updatePhysics(delta)`, `updateRenderer()`, `updateUIFromSettings()`

**Variables:**
- `camelCase` — `collisionCooldown`, `countdownTimer`, `nameEntryMode`
- Module-level mutable state declared with `let` — `let player1, player2, arena, particles`
- Module-level stable references with `const` — `const clock = new THREE.Clock()`

**Constants:**
- `SCREAMING_SNAKE_CASE` — `POWER_UP_EFFECTS`, `DEFAULT_PRESETS`, `ANALOG_THRESHOLD`, `DEAD_ZONE`

**Classes:**
- `PascalCase` — `Player`, `Arena`, `ParticleSystem`, `LightningSystem`, `ShockwaveSystem`

**Types / State strings:**
- State machine values in `'SCREAMING_SNAKE_CASE'` strings — `'MENU'`, `'PLAYING'`, `'GAME_OVER'`, `'ROUND_OVER'`
- Power-up type identifiers — `'ACCELERATION_BOOST'`, `'SIZE_REDUCTION'`, `'INVULNERABILITY'`

## Exports

**Named exports** are used for everything:
```js
// Modules export functions and mutable refs
export let scene, camera, renderer, composer;
export function initRenderer() { ... }
export function updateRenderer() { ... }

// Entities export classes
export class Player { ... }
export class Arena { ... }
```

**No default exports** anywhere in the codebase.

Constants intended for cross-module use are exported with `export`:
```js
export { POWER_UP_EFFECTS };  // also exported at declaration site
```

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected (no `.eslintrc`, `.prettierrc`, `biome.json`).
- Indentation: 4 spaces (observed throughout all source files).
- No trailing semicolons visible in GLSL shaders; semicolons used in JS.

**Linting:** None enforced.

## Comment Patterns

**Numbered step comments** inside init and game loop functions:
```js
// 1. Initialize Systems
// 2. Setup UI Listeners
// 3. Start Game Loop
```
```js
// 1. Update Entities
// 2. Step Physics
// 3. Update Camera ... and Check Player Collisions
// 4. Check Win Conditions
// 5. Render Scene
```

**Section delimiters** used to group related code blocks:
```js
// === PERFORMANCE: Shared geometries to reduce memory and draw calls ===
// --- Gamepad Menu Navigation ---
// --- Enhanced Control Binding: Keyboard & Controller ---
```

**`PERFORMANCE:` prefix** on comments explaining optimisation decisions:
```js
// PERFORMANCE: Skip bloom entirely on mobile
// PERFORMANCE: Only add bloom on desktop
// PERFORMANCE: 1024 is sufficient for this game, 2048 is overkill
// PERFORMANCE: Reduce particle count on mobile
```

**Inline type hints** via comment when meaningful:
```js
let nameEntryMode = 'newgame'; // 'newgame' | 'nextround'
gameState: 'MENU', // 'MENU', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER'
```

## Initialisation Guard Pattern

All init functions guard against double-initialisation using module-level flags:
```js
let initialized = false;
export function initInput() {
    if (initialized) return;
    initialized = true;
    // ...
}

export function initRenderer() {
    if (renderer) return; // Prevent multiple initializations
    // ...
}

// Also via window globals for cross-module state
if (window.__GAME_INITIALIZED__) return;
window.__GAME_INITIALIZED__ = true;
```

## State Management

**Zustand (vanilla)** is the single source of truth for game state, settings, and scores:
- Store: `src/store.js` — `createStore` (not React hook variant)
- Access pattern everywhere: `useGameStore.getState().someValue`
- Mutation pattern: `useGameStore.getState().actionName(args)`
- Settings are persisted to `localStorage` inside store actions

**Module-level `let` variables** hold transient runtime state (entity refs, timers, in-progress counters) that don't need to be shared across modules:
```js
let player1, player2, arena, particles, lightning, shockwaves;
let collisionCooldown = 0;
let winTimer = 0;
```

**`localStorage` directly** for persistence outside the store (player names, presets):
```js
localStorage.getItem('dropfall_p1name')
localStorage.setItem('dropfall_presets', JSON.stringify(presets))
```

## Entity Class Pattern

All game entities follow a consistent class contract:
- `constructor(...)` — creates Three.js meshes and physics bodies, adds to scene
- `update(delta)` — per-frame logic; receives delta time in seconds
- `destroy()` — removes meshes from scene, cleans up physics bodies

Example from `src/entities/Player.js`:
```js
export class Player {
    constructor(id, color, startPosition, inputFn) { ... }
    update(delta, arena, particles) { ... }
    destroy() { ... }
}
```

Example from `src/entities/Arena.js`:
```js
export class Arena {
    constructor() { ... }
    update(delta) { ... }
}
```

Entities import `scene` directly from `src/renderer.js` and manipulate it:
```js
import { scene } from '../renderer.js';
scene.add(this.mesh);
scene.remove(this.mesh);
```

## Game Loop Pattern

Single `animate()` function driven by `requestAnimationFrame`:
```js
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1); // capped

    // 1. Update Entities
    arena.update(delta);
    particles.update(delta);
    // ...

    // 2. Step Physics
    updatePhysics(delta);

    // 3. Update Camera & Check Collisions
    // ...

    // 4. Check Win Conditions
    // ...

    // 5. Render Scene
    updateRenderer();
}
```

Delta time is always capped (typically `Math.min(clock.getDelta(), 0.1)`) to prevent spiral of death when tab is backgrounded.

Physics uses a fixed-timestep accumulator in `src/physics.js`:
```js
accumulator += delta;
if (accumulator > 0.1) accumulator = 0.1;
while (accumulator >= timeStep) {
    world.step();
    accumulator -= timeStep;
}
```

## Rendering Pattern

Three.js post-processing pipeline via EffectComposer in `src/renderer.js`:
- `RenderPass` → `UnrealBloomPass` (desktop only) → `OutputPass`
- Bloom skipped entirely on mobile: `bloomPass.strength = 0`
- Render always via `updateRenderer()` which calls `composer.render()` or falls back to `renderer.render()`

Mobile detection is a shared inline utility duplicated in several files (`isMobileDevice()` appears in `src/physics.js`, `src/renderer.js`, `src/entities/ParticleSystem.js`) — not centralised.

## Error Handling

Minimal formal error handling in main game code. `try/catch` used only in isolated cases in `src/main.js`. The sdf/ subfolder uses verbose `console.error` for init failures.

No custom error classes or error boundary patterns. Failing silently (null checks before calling `.update()`) is the dominant defensive pattern:
```js
if (player1) player1.update(delta, arena, particles);
if (arena) arena.update(delta);
if (particles) particles.update(delta);
```

## Logging

**Main game code (`src/`):** Minimal logging. `console.log` used only for gamepad connect/disconnect events in `src/input.js`.

**SDF subfolder (`src/sdf/`):** Verbose `console.log` throughout init and UI event handlers — treat as development/debug output, not production code style.

`window.dropfallDebug` is exposed as a debug handle for development tooling.

## Caching Patterns

Shared geometries and materials are cached at module level to reduce draw calls:
```js
let SHARED_TILE_GEOMETRY = null;
let TILE_MATERIALS_CACHE = {};

function getSharedTileGeometry(radius, height) {
    if (!SHARED_TILE_GEOMETRY) {
        SHARED_TILE_GEOMETRY = new THREE.CylinderGeometry(...);
    }
    return SHARED_TILE_GEOMETRY;
}
```

Cache keys use template literals from combined parameters: `` `${theme}-${edgeColor}-${baseColor}-${iceColor}` ``

---

*Convention analysis: 2026-03-19*
