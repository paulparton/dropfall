# Codebase Structure

**Analysis Date:** 2026-03-28

## Directory Layout

```
project-root/
├── index.html              # Primary entry (Three.js) — DOM shell + UI markup
├── index-sdf.html          # Alternate entry (ray-marching SDF)
├── package.json            # Vite + dependencies
├── vite.config.js          # Vite build config
├── vitest.config.js        # Vitest unit test config
├── src/
│   ├── main.js             # Orchestrator: init → game loop → UI wiring
│   ├── store.js            # Zustand state store (settings, scores, game state)
│   ├── physics.js          # Rapier3D world + fixed timestep accumulator
│   ├── renderer.js         # Three.js scene, camera, lights, post-processing
│   ├── input.js            # Keyboard + gamepad + touch input handling
│   ├── audio.js            # Web Audio API synthesizer (music + SFX)
│   ├── online.js           # WebSocket multiplayer client
│   ├── style.css           # Global CSS for all UI overlays
│   ├── entities/
│   │   ├── Player.js       # Player sphere mesh + physics body + power-ups
│   │   ├── Arena.js        # Hex-grid arena tiles + state machine
│   │   ├── ParticleSystem.js   # GPU particles with custom GLSL
│   │   ├── LightningSystem.js  # Procedural lightning bolts
│   │   └── ShockwaveSystem.js  # Expanding ring shockwaves
│   ├── ai/
│   │   └── AIController.js # Tactical NPC for single-player mode
│   ├── sdf/
│   │   ├── main.js         # SDF game entry point
│   │   ├── game-engine.js  # SDFGameEngine orchestrator class
│   │   ├── renderer.js     # WebGL ray-marching fullscreen quad
│   │   ├── physics.js      # Rapier3D physics (SDF-specific fork)
│   │   ├── effects.js      # SDF visual effects
│   │   ├── ray-march.glsl  # Main ray-marching shader
│   │   ├── sdf-functions.glsl  # SDF primitives library
│   │   └── test-main.js    # Standalone SDF test harness
│   └── utils/
│       ├── math.js         # Hex grid maths, utilities
│       ├── textures.js     # Canvas-based procedural textures
│       └── themeTextures.js    # Theme-specific material factories
├── server/
│   ├── server.js           # Node.js HTTP + WebSocket server
│   ├── README.md           # Server setup instructions
│   └── public/
│       └── index.html      # Fallback HTML served from server
├── electron/
│   └── preload.js          # Electron IPC preload script for desktop app
├── tests/
│   ├── ui.test.js          # UI component tests (vitest)
│   └── store.test.js       # State store tests (vitest)
├── dist/                   # Vite production build (bundled + minified)
├── .planning/
│   └── codebase/           # GSD analysis documents
├── README.md               # Project overview
├── README_SDF.md           # SDF mode documentation
├── DESKTOP_BUILD.md        # Electron app build instructions
├── QUICK_START.md          # Development quick start
├── SDF_ARCHITECTURE.md     # SDF implementation details
├── SDF_IMPLEMENTATION_GUIDE.md  # SDF building guide
├── IMPLEMENTATION_SUMMARY.md # Implementation notes
├── DELIVERY_SUMMARY.md     # Release notes
├── PERFORMANCE_OPTIMIZATION_SPEC.md  # Performance tuning guide
├── todo.md                 # Development TODO list
└── vite.config.js / vitest.config.js
```

## Directory Purposes

**`src/root files`:**
- **main.js:** Orchestrator—initializes all systems (physics, renderer, input, audio), sets up event handlers for UI, runs requestAnimationFrame game loop, manages game state transitions
- **store.js:** Zustand store—authoritative state for game phase, scores, player names, settings, boost meters, online state; localStorage persistence
- **physics.js:** Rapier3D world initialization and update loop; fixed-timestep accumulator; factory functions for player/tile rigid bodies
- **renderer.js:** Three.js scene, WebGL renderer, post-processing (bloom), camera, lights; exports mutable singletons for entities to populate
- **input.js:** Unified input layer—keyboard + gamepad polling + touch controls; exports getPlayer1Input(), getPlayer2Input()
- **audio.js:** Web Audio API synthesizer—programmatic music generation (adaptive BPM), collision SFX, boost sounds (no audio file assets)
- **online.js:** WebSocket client for multiplayer—connection management, message relay, game lobby, state sync with server
- **style.css:** Global stylesheet for HTML UI overlays (menus, HUD, settings panel, name entry, countdown, game-over screen)

**`src/entities/`:**
- Purpose: Game object classes—each encapsulates Three.js mesh(es) + Rapier physics body + per-frame lifecycle
- **Player.js:** Player sphere entity with power-up system, glow aura, collision feedback, acceleration/deceleration physics
- **Arena.js:** Hexagonal arena grid—tile state machine (NORMAL → ICE → FALLING → DESTROYED), physics bodies for each tile, memory optimization via shared geometries
- **ParticleSystem.js:** GPU-driven particles—custom GLSL ShaderMaterial with additive blending, emitted on collisions
- **LightningSystem.js:** Procedural lightning bolts—animated segments between two points, emitted on player collision + boost
- **ShockwaveSystem.js:** Expanding ring shockwaves—RingGeometry, radial color gradient, emitted at collision epicenter

**`src/ai/`:**
- **AIController.js:** Tactical NPC opponent for single-player mode—state machine (HUNT, FLANK_CHARGE, PUSH, EDGE_ESCAPE), difficulty-parameterized behavior (boost usage, prediction distance)

**`src/sdf/`:**
- Purpose: Experimental alternate game implementation using GLSL ray-marching instead of Three.js geometry
- **main.js:** Entry point for SDF mode (mirrors src/main.js structure)
- **game-engine.js:** SDFGameEngine class—orchestrates SDF physics, renderer, input
- **renderer.js:** WebGL fullscreen quad with ray-march shader; tile state passed as texture uniforms
- **physics.js:** Rapier3D physics fork specific to SDF mode
- **effects.js:** SDF-specific visual effects (not used in primary Three.js path)
- **ray-march.glsl:** Fragment shader—ray-marching loop, scene SDF queries, surface shading, lighting
- **sdf-functions.glsl:** SDF function library—primitives (sdSphere, sdHexPrism), operations (opSmoothUnion, opSubtraction), helpers

**`src/utils/`:**
- **math.js:** Stateless utility functions—hex grid maths (generateHexGrid, hexToPixel, pixelToHex, hexDistance, hexNeighbor)
- **textures.js:** Canvas-based procedural texture generators (createSphereTexture, createDiamondPlateTexture)
- **themeTextures.js:** Theme system—getThemeMaterials(theme) returns material params for `default`, `beach`, `cracked_stone` themes; material caching

**`server/`:**
- **server.js:** Node.js main—HTTP server (static file serving) + WebSocket server (game logic), game instance management, player slot assignment
- **public/:** Fallback HTML for server access

**`electron/`:**
- **preload.js:** IPC preload for Electron desktop app—bridges renderer and main process

**`tests/`:**
- Unit and integration tests (vitest); tests for store actions and UI elements

**`dist/`:**
- Vite production build output—bundled/minified JavaScript and CSS; this folder is committed to git

## Key File Locations

**Entry Points:**
- `index.html`: Primary web entry; loads `src/main.js` as ES module; contains all UI overlay DOM (menus, HUD, settings, name entry, game-over screen)
- `index-sdf.html`: Alternate entry for SDF ray-marching mode; loads `src/sdf/main.js`
- `server/server.js`: Node.js server; runs on `npm run server` or `npm run server:dev`
- `electron/preload.js`: Electron app entry (desktop build)

**Core Systems:**
- `src/main.js`: Game loop orchestrator (line 727: function animate())
- `src/store.js`: Global state management; access via `useGameStore.getState()`
- `src/physics.js`: Rapier world + fixed timestep; exports `world`, `initPhysics()`, `updatePhysics(delta)`
- `src/renderer.js`: Three.js rendering pipeline; exports `scene`, `camera`, `renderer`, `composer`

**Entity Classes:**
- `src/entities/Player.js`: `class Player`; constructor takes (id, color, position, inputCallback)
- `src/entities/Arena.js`: `class Arena`; generates hex grid tiles, manages state transitions
- `src/entities/ParticleSystem.js`: `class ParticleSystem`
- `src/entities/LightningSystem.js`: `class LightningSystem`
- `src/entities/ShockwaveSystem.js`: `class ShockwaveSystem`

**Utilities & Helpers:**
- `src/utils/math.js`: exportedfunctions: `generateHexGrid(radius)`, `hexToPixel(q, r, size)`, `pixelToHex(x, z, size)`
- `src/utils/themeTextures.js`: `getThemeMaterials(theme)` factory; material caching
- `src/audio.js`: `initAudio()`, `playMusic()`, `playCollisionSound(intensity)`, `setMusicSpeed(multiplier)`

**Configuration:**
- `package.json`: Vite, dev/build/test scripts; dependencies: three, @dimforge/rapier3d-compat, zustand, ws
- `vite.config.js`: Vite dev server + build config
- `vitest.config.js`: Test runner config

## Naming Conventions

**Files:**
- Systems/functions: `camelCase.js` (`renderer.js`, `physics.js`, `themeTextures.js`)
- Classes/entities: `PascalCase.js` (`Player.js`, `Arena.js`, `AIController.js`)
- Shaders: `kebab-case.glsl` (`ray-march.glsl`, `sdf-functions.glsl`)
- Tests: `{entity/system}.test.js` (`store.test.js`, `ui.test.js`)

**Classes:**
- PascalCase: `class Player`, `class Arena`, `class ParticleSystem`, `class AIController`, `class SDFGameEngine`

**Constants & Enums:**
- `UPPER_SNAKE_CASE`: `POWER_UP_EFFECTS`, `SHARED_TILE_GEOMETRY`, `DEFAULT_SETTINGS`, game states `'MENU'`, `'PLAYING'`, tile states `'NORMAL'`, `'ICE'`, `'FALLING'`

**Functions/Methods:**
- camelCase: `initPhysics()`, `updateRenderer()`, `getPlayer1Input()`, `hexToPixel()`

**Variables:**
- camelCase: `camera`, `scene`, `renderer`, `world`, `player1`, `player2`, `currentInput`

## Dependency Relationships

**Import Hierarchy** (unidirectional acyclic):

```
main.js
  → store.js, physics.js, renderer.js, input.js, audio.js, online.js
  → entities/Player.js, Arena.js, ParticleSystem.js, etc.
  → ai/AIController.js

entities/*.js
  → renderer.js (scene export)
  → physics.js (world export, factory fns)
  → store.js (useGameStore)
  → utils/themeTextures.js

renderer.js
  → store.js (lazy import for bloom settings)
  → three.js

physics.js
  → @dimforge/rapier3d-compat

input.js
  → store.js (control key bindings)

audio.js
  → store.js (volume settings)

utils/themeTextures.js
  → three.js (MeshStandardMaterial)

No circular dependencies; entities do not import from main.js
```

## Where to Add New Code

**New Game System** (e.g., network sync, replays):
- Create: `src/{systemName}.js` with `function init{Name}()` and `export function update{Name}(delta)`
- Wire into: `src/main.js`
  - `import { init{Name}, update{Name} } from './{systemName}.js'`
  - In `DOMContentLoaded` handler: `await init{Name}()`
  - In `animate()` function: `update{Name}(delta)` at appropriate point

**New Entity/Game Object:**
- Create: `src/entities/{EntityName}.js` with `export class {EntityName} { constructor(...) { } update(delta) { } cleanup() { } }`
- Constructor receives settings: `const settings = useGameStore.getState().settings`
- Add mesh to scene: `scene.add(mesh)`
- Add physics body: Use `createPlayerBody()` or `createTileBody()` from physics.js
- Wire into: `src/main.js`
  - `import { {EntityName} } from './entities/{EntityName}.js'`
  - In `resetEntities()`: `entity = new {EntityName}(...)`
  - In `animate()`: `entity?.update(delta)`

**New Power-Up Effect:**
- Location: `src/entities/Player.js` at top (line ~10–90)
- Add to `POWER_UP_EFFECTS` array with structure:
  ```javascript
  {
    type: 'EFFECT_NAME',
    name: 'Display Name',
    icon: '🎯',
    description: 'Effect description',
    color: 0xrrggbb,
    apply: (player, duration) => { /* modify player state */ },
    remove: (player) => { /* restore player state */ }
  }
  ```

**New Game Setting / Configuration Slider:**
1. `src/store.js`: Add to `defaultSettings` object
2. `index.html`: Add `<input type="range" id="{settingId}">` to settings panel
3. `src/main.js`: Add event listener to apply setting change to store
4. Entities read setting at construction time: `const sphereSize = useGameStore.getState().settings.sphereSize`

**New Theme:**
1. `src/utils/themeTextures.js`: Add function that returns `{ tileMaterialParams, sphereMaterialParams }`
2. Register in `getThemeMaterials(theme)` switch statement
3. `index.html`: Add `<option value="themeName">Theme Name</option>` to `#theme-select` dropdown

**New Utility Function:**
- Math/hex helpers: `src/utils/math.js`
- Texture generators: `src/utils/textures.js`
- Material factories: `src/utils/themeTextures.js`

**New Test:**
- Location: `tests/{entity|system}.test.js`
- Framework: Vitest
- Run: `npm test` or `npm run test:watch`

**New GLSL Shader** (SDF mode only):
- SDF primitives and operations: `src/sdf/sdf-functions.glsl`
- Main rendering logic: `src/sdf/ray-march.glsl`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output (bundled JS + CSS)
- Generated: Yes (`npm run build`)
- Committed: Yes (present in version control)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by gsd-map-codebase agent)
- Committed: Optional

**`server/public/`:**
- Purpose: Static files served by Node.js server
- Contains: Fallback index.html

---

*Structure analysis: 2026-03-28*

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

*Structure analysis: 2026-03-28*
