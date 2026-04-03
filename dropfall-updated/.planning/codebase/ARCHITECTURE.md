# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Game-Loop with Systems & Entities

The codebase uses a classic game-loop architecture where a central orchestrator (`src/main.js`) drives a fixed-timestep physics update and per-frame render tick via `requestAnimationFrame`. There is no formal ECS; instead, each major subsystem is a plain ES module exporting `init*` / `update*` functions, and game objects are plain ES6 classes.

There are **two parallel and largely independent rendering implementations**:
1. **Three.js implementation** (primary) — `src/main.js` + `src/renderer.js` + `src/entities/`
2. **SDF/Ray-marching implementation** (experimental) — `src/sdf/` folder, entered from `index-sdf.html`

Both implementations share `src/store.js`, `src/input.js`, and `src/audio.js`.

**Key Characteristics:**
- Single shared Zustand vanilla store as the authoritative source for game state and settings
- Physics (Rapier3D WASM) is decoupled from rendering via an accumulator-based fixed timestep
- Entities read settings from the store at construction time (not reactively subscribed during runtime)
- UI is vanilla HTML/CSS with DOM manipulation — no UI framework
- State machine: `MENU → NAME_ENTRY → COUNTDOWN → PLAYING → ROUND_OVER → GAME_OVER`

## Layers

**Entry Point / Orchestrator:**
- Purpose: Init all systems, wire DOM events, run the game loop, manage game-state transitions
- Location: `src/main.js`
- Contains: `init()`, `gameLoop()`, `startGame()`, `returnToMenu()`, UI event listeners, preset management, name-entry flow
- Depends on: All systems and entities
- Used by: `index.html` via `<script type="module">`

**State Layer:**
- Purpose: Single source of truth for game state, player scores, settings, boost meters
- Location: `src/store.js`
- Contains: Zustand vanilla store (`useGameStore`) with state fields and action methods
- Depends on: `zustand/vanilla`, `localStorage`
- Used by: All systems and entities that need to read settings or dispatch state transitions

**Systems Layer:**
- Purpose: Stateless-ish modules with `init*` + `update*` lifecycle, managing one cross-cutting concern each
- Location: `src/renderer.js`, `src/physics.js`, `src/input.js`, `src/audio.js`
- Contains:
  - `renderer.js` — Three.js `WebGLRenderer`, `EffectComposer` (UnrealBloom + OutputPass), scene, camera, lights; exports `scene` and `camera` for entities to add meshes
  - `physics.js` — Rapier3D WASM world; accumulator-based fixed timestep; factory functions `createPlayerBody`, `createTileBody`
  - `input.js` — Keyboard (`keydown`/`keyup`) + Gamepad API polling; produces `{ up, down, left, right, boost }` structs per player
  - `audio.js` — Web Audio API synthesizer (programmatic music + SFX); no audio file assets
- Depends on: each other minimally; renderer imports from store for bloom settings
- Used by: `src/main.js` (init sequence); entities import `scene`, `world` directly

**Entities Layer:**
- Purpose: Game objects with their own Three.js meshes + Rapier physics bodies + per-frame `update()` methods
- Location: `src/entities/`
- Contains:
  - `Player.js` — Sphere player with physics body, aura mesh, glow light, power-up system; accepts input callback
  - `Arena.js` — Hex grid of tiles; manages tile state machine (`NORMAL → WARNING → FALLING → ICE → PORTAL → BONUS`); shared geometry/material optimisation
  - `ParticleSystem.js` — GPU-driven particles using custom GLSL ShaderMaterial with additive blending
  - `LightningSystem.js` — Procedural segmented lightning bolts with branching
  - `ShockwaveSystem.js` — Expanding ring meshes for collision impact feedback
- Depends on: `renderer.js` (scene), `physics.js` (world, factory fns), `store.js` (settings), `utils/`
- Used by: `src/main.js`

**Utilities Layer:**
- Purpose: Stateless pure-function helpers
- Location: `src/utils/`
- Contains:
  - `math.js` — Hex grid maths: `hexToPixel`, `pixelToHex`, `generateHexGrid`, `hexDistance`, `hexNeighbor`
  - `textures.js` — Canvas-based procedural texture generators (`createSphereTexture`, `createDiamondPlateTexture`)
  - `themeTextures.js` — Theme-aware material parameter factories for `default` / `beach` / `cracked_stone` themes with cached texture generation

**SDF Sub-system (Experimental):**
- Purpose: Alternative WebGL ray-marching renderer for the same game logic
- Location: `src/sdf/`
- Contains:
  - `game-engine.js` — `SDFGameEngine` class; orchestrates SDF physics + renderer + input
  - `renderer.js` — WebGL `THREE.PlaneGeometry` fullscreen quad with ray-march shader; tile state passed as texture uniforms
  - `physics.js` — Fork of main `physics.js` using same Rapier3D library
  - `effects.js` — SDF-specific visual effects
  - `ray-march.glsl` / `sdf-functions.glsl` — GLSL shaders: scene SDF, ray-marching loop, shading
  - `main.js` — Entry point (same structure as `src/main.js`), loaded by `index-sdf.html`
  - `test-main.js` — Standalone test/debug harness for the SDF renderer
- Shares with main: `src/store.js`, `src/input.js`, `src/audio.js`

## Data Flow

**Main Game Loop:**

1. `requestAnimationFrame` calls `gameLoop(delta)` in `src/main.js`
2. `updatePhysics(delta)` advances Rapier world with fixed-timestep accumulator (16.67ms / 33ms on mobile)
3. `player1.update(delta, input)` and `player2.update(delta, input)` apply forces from input to Rapier bodies, sync Three.js mesh positions from physics, tick power-up timers
4. `arena.update(delta)` ticks tile destruction timers, transitions tile states, removes fallen tiles from scene + physics world
5. `particles.update(delta)`, `lightning.update(delta)`, `shockwaves.update(delta)` advance visual effect lifetimes
6. Collision detection: `main.js` reads both players' Rapier body positions each frame and applies knockback impulses when spheres overlap, triggering particle/lightning/shockwave emissions
7. `updateRenderer()` calls `composer.render()` (Three.js post-processing pipeline)

**State Transitions:**

```
click "Start" → store.enterNameEntry() → ['NAME_ENTRY']
  → confirm names → store.startGame() → ['COUNTDOWN']
  → countdown ends → store.setPlaying() → ['PLAYING']
  → player falls → store.endRound(winner) → ['ROUND_OVER'] or ['GAME_OVER']
  → auto-restart / next round → store.startRound() → ['COUNTDOWN']
  → return to menu → store.returnToMenu() → ['MENU']
```

**Settings Flow:**

1. User adjusts slider in settings panel (`index.html` DOM)
2. `input` event → `store.updateSetting(key, value)` → persists to `localStorage`
3. Settings are read from store **once at construction time** by entities (`new Player(...)`, `new Arena()`)
4. Re-read only when a new game/round starts (entities are reconstructed)

**Input Flow:**

1. `input.js` polls `navigator.getGamepads()` every frame via `requestAnimationFrame` loop
2. Also listens to keyboard `keydown`/`keyup` events globally
3. `getPlayer1Input()` / `getPlayer2Input()` return `{ up, down, left, right, boost }` merged from keyboard + gamepad
4. `Player.update()` consumes this struct to compute force vectors

## Key Abstractions

**Game Store (`useGameStore`):**
- Purpose: Central state bus — replaces scattered global variables
- Location: `src/store.js`
- Pattern: Zustand vanilla store; accessed via `useGameStore.getState()` (no React)
- State fields: `gameState`, `winner`, `p1Score`, `p2Score`, `player1Boost`, `player2Boost`, `settings`, `activeTileEffects`, `p1Name`, `p2Name`

**Hex Grid (`src/utils/math.js`):**
- Purpose: Axial coordinate system for the arena tile grid
- Pattern: Cube-coordinate hex maths (flat-top orientation)
- `generateHexGrid(radius)` → array of `{q, r}` coordinates
- `hexToPixel(q, r, size)` → `{x, z}` world position
- `pixelToHex(x, z, size)` → `{q, r}` for hit detection (e.g. knowing which tile a player is on)

**Power-Up System (`src/entities/Player.js`):**
- Purpose: Timed runtime modifications to player physics and visual properties
- Pattern: Data-driven array of `{ type, apply(player, duration), remove(player) }` objects
- Applied effects mutate player instance properties (`sphereAccelMultiplier`, `sizeMultiplier`, etc.)
- `POWER_UP_EFFECTS` array is exported for use by other systems (showcase, notifications)

**Tile State Machine (`src/entities/Arena.js`):**
- States: `NORMAL`, `WARNING`, `FALLING`, `FALLEN`, `ICE`, `PORTAL`, `BONUS`
- Transitions driven by timers; falling tiles have their Rapier physics body removed from the world and their Three.js mesh animated downward

## Entry Points

**Primary Entry Point (Three.js):**
- Location: `src/main.js` — imported by `index.html`
- Triggers: `DOMContentLoaded` event
- Responsibilities: System init, entity construction, game loop, UI wiring

**SDF Entry Point:**
- Location: `src/sdf/main.js` — imported by `index-sdf.html`
- Triggers: `DOMContentLoaded` event
- Responsibilities: SDF engine init, shared UI wiring, SDF game loop

## Error Handling

**Strategy:** Minimal; errors surface to browser console. The `initGame()` in the SDF main wraps initialisation in try/catch with console error logging.

**Patterns:**
- Guard-clause singletons: `if (renderer) return;` / `if (window.__GAME_INITIALIZED__) return;` prevent double-init
- Physics accumulator cap (`if (accumulator > 0.1) accumulator = 0.1`) prevents spiral-of-death
- `localStorage` parse wrapped in try/catch with fallback to defaults

## Cross-Cutting Concerns

**Performance:** Mobile device detection (`isMobileDevice()`) is duplicated in `renderer.js`, `physics.js`, `entities/ParticleSystem.js` — used at init time to scale down quality (pixel ratio, shadow res, particle count, physics timestep, bloom skip).

**Theming:** `src/utils/themeTextures.js` returns theme-specific `MeshStandardMaterial` params (colors + procedural texture maps). All entities accept a `theme` string sourced from `store.settings.theme`.

**Logging:** Raw `console.log` / `console.error` throughout; no logging library. SDF init path is heavily instrumented; main path is sparse.

**Validation:** None at runtime. Settings are validated only by HTML `<input type="range" min max>` constraints.

---

*Architecture analysis: 2026-03-19*
