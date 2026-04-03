# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
project-root/
├── index.html              # Primary entry — loads Three.js game (src/main.js)
├── index-sdf.html          # Alternate entry — loads SDF ray-marching game (src/sdf/main.js)
├── package.json            # Vite + three + rapier3d + zustand
├── src/
│   ├── main.js             # Primary game orchestrator + game loop + UI wiring
│   ├── store.js            # Zustand vanilla state store (settings, scores, game state)
│   ├── physics.js          # Rapier3D WASM world, factory fns: createPlayerBody, createTileBody
│   ├── renderer.js         # Three.js WebGLRenderer, EffectComposer, scene/camera exports
│   ├── input.js            # Keyboard + Gamepad API polling; per-player input structs
│   ├── audio.js            # Web Audio API synthesizer — programmatic music + SFX
│   ├── style.css           # Global CSS for HTML UI overlays (menus, HUD, settings panel)
│   ├── entities/
│   │   ├── Player.js       # Player sphere: Three.js mesh + Rapier body + power-up system
│   │   ├── Arena.js        # Hex-grid arena with tile state machine and physics tiles
│   │   ├── ParticleSystem.js   # GPU-driven custom GLSL ShaderMaterial particles
│   │   ├── LightningSystem.js  # Procedural branching lightning bolt visuals
│   │   └── ShockwaveSystem.js  # Expanding ring shockwave effect on collision
│   ├── sdf/
│   │   ├── main.js         # SDF entry point (mirrors src/main.js for ray-marching build)
│   │   ├── game-engine.js  # SDFGameEngine class — orchestrates SDF physics + renderer
│   │   ├── renderer.js     # WebGL fullscreen-quad ray-marching renderer
│   │   ├── physics.js      # Rapier3D physics fork for SDF mode
│   │   ├── effects.js      # SDF-specific visual effects
│   │   ├── ray-march.glsl  # Main ray-marching GLSL shader (scene SDF, marching loop, shading)
│   │   ├── sdf-functions.glsl  # SDF primitive library (sdSphere, sdHexPrism, opSmoothUnion, etc.)
│   │   └── test-main.js    # Standalone SDF renderer test/debug harness
│   └── utils/
│       ├── math.js         # Hex grid maths: hexToPixel, pixelToHex, generateHexGrid, hexDistance
│       ├── textures.js     # Canvas-based procedural texture generators (sphere, diamond plate)
│       └── themeTextures.js    # Theme-aware material params: default/beach/cracked_stone
├── dist/                   # Vite production build output (committed)
│   ├── index.html
│   └── assets/
│       ├── index-DpGJRYw-.js
│       └── index-Jy079-Wx.css
├── README.md
├── README_SDF.md
├── SDF_ARCHITECTURE.md
├── SDF_IMPLEMENTATION_GUIDE.md
├── IMPLEMENTATION_SUMMARY.md
├── DELIVERY_SUMMARY.md
├── PERFORMANCE_OPTIMIZATION_SPEC.md
├── PHASE_1_OPTIMIZATIONS_COMPLETE.md
├── QUICK_START.md
└── todo.md
```

## Directory Purposes

**`src/` (source root):**
- Purpose: All game source files; split into systems (flat files) and sub-directories by domain
- Key files: `main.js` (orchestrator), `store.js` (state), `physics.js`, `renderer.js`, `input.js`, `audio.js`

**`src/entities/`:**
- Purpose: Game object classes — each manages its own Three.js mesh(es) and Rapier physics body
- Contains: Class-per-file, each exported as named class
- Key files: `Player.js`, `Arena.js`, `ParticleSystem.js`, `LightningSystem.js`, `ShockwaveSystem.js`

**`src/sdf/`:**
- Purpose: Experimental/alternate implementation using WebGL ray-marching instead of Three.js meshes
- Contains: Parallel set of game-engine, renderer, physics; plus raw `.glsl` shader files
- Key files: `game-engine.js` (engine class), `renderer.js` (WebGL), `ray-march.glsl` (main shader)
- Note: Shares `src/store.js`, `src/input.js`, `src/audio.js` with the main implementation

**`src/utils/`:**
- Purpose: Stateless pure-function helpers with no game-state dependencies
- Contains: Math utilities, procedural texture generators, theme material factories
- Key files: `math.js` (hex grid), `themeTextures.js` (theme system)

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: Yes (present in repo)

## Key File Locations

**Entry Points:**
- `index.html`: Primary HTML shell — loads `src/main.js` via `<script type="module">`; contains all UI overlay markup (menu, HUD, settings panel, name entry, game-over screen)
- `index-sdf.html`: Alternate shell for SDF ray-marching build — loads `src/sdf/main.js`
- `src/main.js`: Primary JavaScript entry — `init()` called once on load; exports nothing (side-effect module)
- `src/sdf/main.js`: SDF JavaScript entry — same pattern

**Global State:**
- `src/store.js`: Zustand vanilla store — access anywhere via `useGameStore.getState()`; persists settings to `localStorage` under key `dropfall_settings`

**Physics:**
- `src/physics.js`: Rapier world init + exported `world` + factory functions `createPlayerBody(position, radius, mass, restitution)` and `createTileBody(position, radius, height)`

**Rendering:**
- `src/renderer.js`: Exports `scene`, `camera`, `renderer`, `composer`, `ambientLight`, `directionalLight` — consumed directly by entities to add meshes

**Entities:**
- `src/entities/Player.js`: `class Player` + exported `POWER_UP_EFFECTS` array
- `src/entities/Arena.js`: `class Arena`
- `src/entities/ParticleSystem.js`: `class ParticleSystem`
- `src/entities/LightningSystem.js`: `class LightningSystem`
- `src/entities/ShockwaveSystem.js`: `class ShockwaveSystem`

**Utilities:**
- `src/utils/math.js`: `generateHexGrid(radius)`, `hexToPixel(q, r, size)`, `pixelToHex(x, z, size)`, `hexDistance(a, b)`, `hexNeighbor(hex, dir)`
- `src/utils/themeTextures.js`: `getThemeMaterials(theme)` → `{ tileMaterialParams, sphereMaterialParams }`

**Shaders (SDF only):**
- `src/sdf/ray-march.glsl`: Main fragment shader — ray-marching loop calls `sceneSDF`
- `src/sdf/sdf-functions.glsl`: SDF primitive library — `sdSphere`, `sdBox`, `sdHexPrism`, `opSmoothUnion`, `calcNormal`

**Configuration:**
- `package.json`: Vite dev/build/preview scripts; dependencies: `three`, `@dimforge/rapier3d-compat`, `zustand`

## Naming Conventions

**Files:**
- Systems/utilities: `camelCase.js` (e.g., `physics.js`, `themeTextures.js`)
- Entities (classes): `PascalCase.js` (e.g., `Player.js`, `Arena.js`, `ParticleSystem.js`)
- GLSL shaders: `kebab-case.glsl` (e.g., `ray-march.glsl`, `sdf-functions.glsl`)
- SDF engine files: `kebab-case.js` (e.g., `game-engine.js`, `test-main.js`)

**Exports:**
- Systems expose named function exports: `export function initRenderer()`, `export function updateRenderer()`
- Entities export their class: `export class Player { ... }`
- Store exports a single named store: `export const useGameStore`
- Renderer/Physics export mutable singleton references: `export let scene, camera, world`

**Classes:**
- PascalCase (`Player`, `Arena`, `SDFGameEngine`)
- One class per file

**Constants:**
- `UPPER_SNAKE_CASE` for constants and enums (e.g., `POWER_UP_EFFECTS`, `DEFAULT_PRESETS`, tile states `'NORMAL'`, `'WARNING'`)

## Module Import Patterns

**Systems import from each other minimally:**
- `renderer.js` → lazy-imports `store.js` (inside `.then()`) for bloom setting
- `physics.js` → no imports from other src modules (only Rapier)
- `input.js` → imports `store.js` for control key bindings

**Entities import from systems by name:**
```js
import { scene } from '../renderer.js';
import { world, createPlayerBody } from '../physics.js';
import { useGameStore } from '../store.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
```

**Main orchestrator imports everything:**
```js
import { initPhysics, updatePhysics } from './physics.js';
import { initRenderer, updateRenderer, camera, scene } from './renderer.js';
import { initInput, getPlayer1Input, getPlayer2Input } from './input.js';
import { Player } from './entities/Player.js';
import { Arena } from './entities/Arena.js';
// ... etc
```

## Where to Add New Code

**New game system (e.g., network multiplayer, replay):**
- Implementation: `src/{systemName}.js` — export `init{Name}()` and `update{Name}(delta)` functions
- Wire into: `src/main.js` `init()` (init call) and `gameLoop()` (update call)

**New entity / game object:**
- Implementation: `src/entities/{EntityName}.js` — export `class {EntityName}`
- Constructor receives settings from `useGameStore.getState().settings`
- Add Three.js mesh via `scene.add()`; add physics body via `createTileBody` / `createPlayerBody`
- Wire into: `src/main.js` — instantiate in `init()`, call `entity.update(delta)` in `gameLoop()`

**New power-up:**
- Location: `src/entities/Player.js` — add entry to `POWER_UP_EFFECTS` array
- Shape: `{ type, name, icon, description, color, apply(player, duration), remove(player) }`

**New setting / slider:**
- Add default value to `defaultSettings` in `src/store.js`
- Add `<input type="range">` to `index.html` settings panel
- Add mapping entry to `settingsMap` in `src/main.js`
- Entities read settings at construction time from `useGameStore.getState().settings`

**New theme:**
- Location: `src/utils/themeTextures.js` — add a `generate{ThemeName}Theme()` function and register it in `getThemeMaterials(theme)`
- Add `<option>` to the `#theme-select` dropdown in `index.html`

**New utility function:**
- Stateless hex/math helpers: `src/utils/math.js`
- Texture generators: `src/utils/textures.js`
- Material/theme helpers: `src/utils/themeTextures.js`

**New GLSL shader (SDF mode):**
- SDF primitives: `src/sdf/sdf-functions.glsl`
- Scene composition / rendering logic: `src/sdf/ray-march.glsl`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output (bundled JS + CSS)
- Generated: Yes (by `npm run build`)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Codebase analysis documents for GSD planning workflow
- Generated: Yes (by gsd-map-codebase)
- Committed: Optional

---

*Structure analysis: 2026-03-19*
