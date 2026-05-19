# Coding Conventions

**Analysis Date:** 2026-03-28

## Naming Patterns

**Files:**
- Utility/function files: `camelCase` (e.g., `physics.js`, `input.js`, `store.js`, `audio.js`, `renderer.js`)
- Class/entity files: `PascalCase` (e.g., `Player.js`, `Arena.js`, `ParticleSystem.js`, `AIController.js`)
- Test files: `*.test.js` pattern (e.g., `store.test.js`, `ui.test.js`)

**Functions:**
- All functions: `camelCase` (e.g., `initPhysics()`, `updateRenderer()`, `getPlayer1Input()`, `pixelToHex()`)
- Init functions: `init` prefix (e.g., `initPhysics()`, `initRenderer()`, `initInput()`, `initAudio()`)
- Update functions: `update` prefix (e.g., `updatePhysics()`, `updateRenderer()`)
- Getter/checker functions: `get` or `is` prefix (e.g., `getThemeMaterials()`, `isMobileDevice()`, `getGamepadState()`)

**Variables & Constants:**
- Variables: `camelCase` (e.g., `collisionCooldown`, `countdownTimer`, `nameEntryMode`)
- Boolean flags: `is/has` prefix (e.g., `initialized`, `isMobile`, `isMusicPlaying`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `POWER_UP_EFFECTS`, `DEAD_ZONE`, `ANALOG_THRESHOLD`, `MAX_DELTA`)
- State enum strings: `'SCREAMING_SNAKE_CASE'` (e.g., `'MENU'`, `'PLAYING'`, `'GAME_OVER'`, `'COUNTDOWN'`)

**Classes:**
- PascalCase (e.g., `Player`, `Arena`, `ParticleSystem`, `LightningSystem`, `AIController`)

## Module System

**Format:** ES6 modules throughout (`type: "module"` in package.json)

**Imports are always explicit named or namespace:**
```js
import * as THREE from 'three';
import { useGameStore } from './store.js';
import { initPhysics, updatePhysics } from './physics.js';
import { Player } from './entities/Player.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { setBoostSound } from '../audio.js';
```

**All imports include `.js` extension** — required for native ES module resolution with Vite
```js
import * as THREE from 'three';
import { createPlayerBody, world } from '../physics.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { useGameStore } from '../store.js';
```

**Dynamic imports** are used for deferred/settings-triggered loads:
```js
import('./audio.js').then(module => { module.setMusicVolume(val); });
import('./renderer.js').then(module => { /* update bloom */ });
```

**No barrel files** — each module is imported directly by path. All imports referenced by full relative path.

## Naming Patterns

**Files:**
- Modules: `camelCase.js` — `src/main.js`, `src/renderer.js`, `src/physics.js`, `src/store.js`, `src/audio.js`, `src/input.js`
- Entity classes: `PascalCase.js` — `src/entities/Player.js`, `src/entities/Arena.js`, `src/entities/ParticleSystem.js`, `src/entities/LightningSystem.js`
- Utility modules: `camelCase.js` — `src/utils/math.js`, `src/utils/themeTextures.js`
- System/AI: `PascalCase.js` — `src/ai/AIController.js`

**Functions:**
- `camelCase` — `initRenderer()`, `updatePhysics()`, `getPresetsFromStorage()`
- Init functions prefixed with `init` — `initRenderer`, `initPhysics`, `initAudio`, `initInput`
- Update functions prefixed with `update` — `updatePhysics(delta)`, `updateRenderer()`, `updateUIFromSettings()`
- Get/Query functions — `getPlayer1Input()`, `getGamepadState()`, `getThemeMaterials()`

Example from `src/input.js`:
```js
export function initInput() {
    if (initialized) return;
    initialized = true;
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    // ...
}

export function getPlayer1Input() {
    const controls = useGameStore.getState().settings.controls.p1;
    return {
        forward: keys[controls.up] || gamepadState[0].up || touchState[0].up,
        backward: keys[controls.down] || gamepadState[0].down || touchState[0].down,
        left: keys[controls.left] || gamepadState[0].left || touchState[0].left,
        right: keys[controls.right] || gamepadState[0].right || touchState[0].right,
        boost: keys[controls.boost] || gamepadState[0].boost || touchState[0].boost
    };
}
```

**Variables:**
- `camelCase` — `collisionCooldown`, `countdownTimer`, `nameEntryMode`, `isMusicPlaying`
- Module-level mutable state declared with `let` — `let player1, player2, arena, particles, lightning, shockwaves, aiController`
- Module-level stable references with `const` — `const clock = new THREE.Clock()`, `const screens = { menu, gameMode, ... }`
- Boolean flags with `is` or `has` prefix — `isInvulnerable`, `isDead`, `isMusicPlaying`, `hasBoost`

**Constants:**
- `SCREAMING_SNAKE_CASE` — `POWER_UP_EFFECTS`, `ANALOG_THRESHOLD`, `DEAD_ZONE`, `COLLISION_COOLDOWN`
- Thresholds and limits — `const ANALOG_THRESHOLD = 0.30`, `const MAX_DELTA = 0.1`

Example from `src/input.js`:
```js
const ANALOG_THRESHOLD = 0.30;
const DEAD_ZONE = 0.15;

function applyDeadZone(value) {
    if (Math.abs(value) < DEAD_ZONE) return 0;
    return (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE) * Math.sign(value);
}
```

**Classes:**
- `PascalCase` — `Player`, `Arena`, `ParticleSystem`, `LightningSystem`, `ShockwaveSystem`

**Types / State strings:**
- State machine values in `'SCREAMING_SNAKE_CASE'` strings — `'MENU'`, `'PLAYING'`, `'GAME_OVER'`, `'ROUND_OVER'`, `'COUNTDOWN'`, `'NAME_ENTRY'`
- Power-up type identifiers — `'ACCELERATION_BOOST'`, `'SIZE_REDUCTION'`, `'INVULNERABILITY'`, `'SPEED_BURST'`
- Game mode values — `'1P'`, `'2P'`, `'ONLINE'`
- Difficulty values — `'easy'`, `'normal'`, `'hard'`

Example from `src/store.js`:
```js
gameState: 'MENU', // 'MENU', 'GAME_MODE_SELECT', 'DIFFICULTY_SELECT', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'ONLINE'
gameMode: localStorage.getItem('dropfall_gamemode') || '2P', // '1P', '2P', or 'ONLINE'
difficulty: localStorage.getItem('dropfall_difficulty') || 'normal', // 'easy', 'normal', 'hard'
```

## Exports

**Named exports** are used exclusively:
```js
// Modules export functions and mutable refs
export let scene, camera, renderer, composer, ambientLight, directionalLight;
export function initRenderer() { ... }
export function updateRenderer() { ... }

// Entities export classes
export class Player { ... }
export class Arena { ... }
```

**No default exports** exist anywhere in the codebase — all imports use named syntax.

Constants intended for cross-module use are exported with `export`:
```js
export { POWER_UP_EFFECTS };  // From src/entities/Player.js
```

Zustand store exported as named:
```js
export const useGameStore = createStore((set) => ({ ... }));
```

## Code Style

**Formatting:**
- No Prettier or ESLint config files configured (no `.eslintrc`, `.prettierrc`, `biome.json`).
- Indentation: 4 spaces consistently applied throughout all source files.
- Line length: No hard limit observed; lines range from 40 to 150+ characters.
- Semicolons: Used at end of all JS statements.

**Linting:** None enforced — formatting is manual/conventional.

## Comment Patterns

**Numbered step comments** inside init and loop functions:
```js
// 1. Initialize Systems
// 2. Setup UI Listeners
// 3. Start Game Loop
```

From `src/main.js` animation loop:
```js
// 1. Update Entities
// 2. Step Physics
// 3. Update Camera and Check Player Collisions
// 4. Check Win Conditions
// 5. Render Scene
```

**Section delimiters** used to group related code blocks — three styles:
```js
// ============================================
// SCREEN MANAGEMENT
// ============================================

// --- Gamepad Menu Navigation ---

// === PERFORMANCE: Shared geometries ===
```

**`PERFORMANCE:` prefix** on comments explaining optimization decisions:
```js
// PERFORMANCE: Skip bloom entirely on mobile
// PERFORMANCE: Only add bloom on desktop
// PERFORMANCE: 1024 is sufficient for this game, 2048 is overkill
// PERFORMANCE: Reduce particle count on mobile
```

From `src/renderer.js`:
```js
if (isMobile) {
    // PERFORMANCE: Skip bloom entirely on mobile
    bloomPass.strength = 0;
} else {
    // Get initial bloom level from store
    import('./store.js').then(module => {
        const settings = module.useGameStore.getState().settings;
        const defaultBloom = settings.bloomLevel !== undefined ? settings.bloomLevel : 2.0;
        bloomPass.strength = defaultBloom;
    });
    bloomPass.radius = 0.5;
}
```

**Inline type hints** via comment when meaningful:
```js
let nameEntryMode = 'newgame'; // 'newgame' | 'nextround'
gameState: 'MENU', // 'MENU', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER'
const COLLISION_COOLDOWN = 0.5; // seconds
let countdownTimer = 3.0; // countdown in seconds
```

**Prefix-based console logging** for debugging:
```js
console.log('[Proceed] Starting name entry flow');
console.error('[Game] Initialization failed:', error);
console.log(`Gamepad connected at index ${gp.index}: ${gp.id}`);
```

## Initialization Guard Pattern

All init functions guard against double-initialization using module-level flags or return-early on existing state:

Pattern 1 — Module flag:
```js
let initialized = false;
export function initInput() {
    if (initialized) return;
    initialized = true;
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    // ...
}
```

Pattern 2 — Check exported state:
```js
export function initRenderer() {
    if (renderer) return; // Prevent multiple initializations
    renderer = new THREE.WebGLRenderer({ ... });
    // ...
}
```

Pattern 3 — Window global for cross-module coordination:
```js
async function init() {
    if (window.__GAME_INITIALIZED__) return;
    window.__GAME_INITIALIZED__ = true;
    // Initialize systems
}
```

Also for Rapier physics:
```js
export async function initPhysics() {
    if (window.__RAPIER_INITIALIZED__) {
        world = window.__RAPIER_WORLD__;
        return world;
    }
    await RAPIER.init();
    window.__RAPIER_INITIALIZED__ = true;
    // ...
}
```

## State Management

**Zustand (vanilla store)** is the single source of truth for game state, settings, and scores:
- Store location: `src/store.js`
- Store creation: `createStore` (vanilla, not React hook variant)
- Access pattern: `useGameStore.getState().someValue`
- Mutation pattern: `useGameStore.getState().actionName(args)`
- Settings are persisted to `localStorage` inside store actions

From `src/store.js`:
```js
export const useGameStore = createStore((set) => ({
    // State
    gameState: 'MENU',
    gameMode: localStorage.getItem('dropfall_gamemode') || '2P',
    difficulty: localStorage.getItem('dropfall_difficulty') || 'normal',
    winner: null,
    p1Score: 0,
    p2Score: 0,
    
    // Actions
    updateSetting: (key, value) => set((state) => {
        const newSettings = { ...state.settings, [key]: value };
        localStorage.setItem('dropfall_settings', JSON.stringify(newSettings));
        return { settings: newSettings };
    }),
    
    setGameMode: (mode) => set((state) => {
        localStorage.setItem('dropfall_gamemode', mode);
        const nextState = mode === '1P' ? 'DIFFICULTY_SELECT' : mode === 'ONLINE' ? 'MENU' : 'NAME_ENTRY';
        return { gameMode: mode, gameState: nextState };
    }),
}));
```

**Module-level `let` variables** hold transient runtime state (entity refs, timers, in-progress counters) that don't need to be persisted or shared across modules:

From `src/main.js`:
```js
let player1, player2, arena, particles, lightning, shockwaves, aiController;
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
let winTimer = 0;
let pendingWinner = null;
let countdownTimer = 3.0;
let nameEntryMode = 'newgame';
```

## Error Handling

**Try-catch** used at top-level init functions:
```js
async function init() {
    if (window.__GAME_INITIALIZED__) return;
    window.__GAME_INITIALIZED__ = true;

    try {
        initRenderer();
        initInput();
        await initPhysics();
        arena = new Arena();
        setupButtonHandlers();
    } catch (error) {
        console.error('[Game] Initialization failed:', error);
    }
}
```

**Optional chaining and null-coalescing** to avoid throwing:
```js
screens.menu?.classList.add('hidden');
document.getElementById('name-entry-play-btn')?.addEventListener('click', proceedFromNameEntry);
const bloomLevel = settings.bloomLevel !== undefined ? settings.bloomLevel : 0;
```

**Error event handlers** for external systems (gamepad, WebSocket):
```js
window.addEventListener('gamepadconnected', (e) => {
    console.log(`Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
});

window.addEventListener('gamepaddisconnected', (e) => {
    console.log(`Gamepad disconnected from index ${e.gamepad.index}`);
});

online.on('error', (msg) => {
    document.getElementById('online-connect-error').textContent = msg;
});
```

**Try-catch in polling loops** to continue on error:
```js
function update() {
    try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
            const gp = pads[playerIdx];
            if (gp && gp.connected) {
                // Process gamepad state
            }
        }
    } catch (e) {
        console.error('Error polling gamepads:', e);
        gamepadState[0] = { up: false, down: false, left: false, right: false, boost: false };
        gamepadState[1] = { up: false, down: false, left: false, right: false, boost: false };
    }
    pollGamepadLoopId = requestAnimationFrame(update);
}
```

## DOM-Related Patterns

**Screen management** uses class toggling:
```js
const screens = {
    menu: document.getElementById('menu'),
    gameModeSelect: document.getElementById('game-mode-select'),
    nameEntry: document.getElementById('name-entry'),
    hud: document.getElementById('hud'),
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
    const screen = screens[screenName];
    if (screen) screen.classList.remove('hidden');
}
```

**Event listeners** use object keys and optional chaining:
```js
Object.keys(screens).forEach(key => {
    screens[key].classList.add('hidden');
});

document.getElementById('name-entry-play-btn')?.addEventListener('click', proceedFromNameEntry);
document.getElementById('p1-name-field')?.value;
```

**Inline styles** constructed when dynamic values are needed:
```js
notification.style.cssText = `
    color: ${hexColor};
    text-shadow: 0 0 20px ${hexColor}, 0 0 40px ${hexColor};
    border-color: ${hexColor};
    box-shadow: 0 0 30px ${hexColor} inset, 0 0 50px ${hexColor};
`;
```
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

*Convention analysis: 2026-03-28*
