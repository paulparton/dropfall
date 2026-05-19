# Testing Patterns

**Analysis Date:** 2026-03-28

## Test Framework

**Runner:** Vitest v4.1.0

**Assertion Library:** Vitest globals (expect)

**Environment:** jsdom (browser DOM simulation)

**Configuration:** `vitest.config.js`
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
```

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode (run tests on file change)
```

## Test Files

**Location:** `tests/` directory (co-located in dedicated folder, not alongside source)

**Current test files:**
- `tests/store.test.js` — 15 tests
- `tests/ui.test.js` — 19 tests

**Total:** 34 tests, all passing ✓

```bash
Test Files  2 passed (2)
     Tests  34 passed (34)
  Duration  963ms (transform 49ms, setup 0ms, import 80ms, tests 14ms, environment 1.57s)
```

### Store Tests (`tests/store.test.js`)

**Coverage:** Zustand game state store actions and transitions

**Test structure:**
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';

function createTestStore() {
    return createStore((set) => ({
        gameState: 'MENU',
        gameMode: '2P',
        // ... initial state
        
        setGameMode: (mode) => set((state) => ({
            gameMode: mode,
            gameState: mode === '1P' ? 'DIFFICULTY_SELECT' : mode === 'ONLINE' ? 'MENU' : 'NAME_ENTRY'
        })),
        // ... actions
    }));
}

describe('Game Store', () => {
    let store;

    beforeEach(() => {
        store = createTestStore();
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const state = store.getState();
            expect(state.gameState).toBe('MENU');
            expect(state.gameMode).toBe('2P');
            expect(state.p1Score).toBe(0);
            expect(state.p2Score).toBe(0);
        });
    });
});
```

**Test suites:**
- **Initial State** — 2 tests: default values for state and settings
- **Game Mode Selection** — 3 tests: transitions for '1P', '2P', 'ONLINE' modes
- **Game Flow** — 6 tests: round start, state transitions, score updates, game over on 3-round threshold
- **Settings and Names** — 4 tests: name persistence, settings updates, difficulty selection

**Key patterns:**
- `beforeEach` creates fresh store instance before each test (isolation)
- Zustand store accessed via `store.getState()` 
- Actions called directly: `store.getState().setGameMode('1P')`
- State verified after actions: `store.getState()` read-only verification

### UI Tests (`tests/ui.test.js`)

**Coverage:** DOM screen management, button IDs, settings structure, online multiplayer state

**Test structure:**
```js
import { describe, it, expect } from 'vitest';

describe('Screen Management', () => {
    const screenStates = {};
    
    function createMockScreen(id) {
        screenStates[id] = true; // starts hidden
        return {
            id,
            classList: {
                add: (cls) => { if (cls === 'hidden') screenStates[id] = true; },
                remove: (cls) => { if (cls === 'hidden') screenStates[id] = false; },
                contains: (cls) => cls === 'hidden' ? screenStates[id] : false,
                toggle: (cls) => { if (cls === 'hidden') screenStates[id] = !screenStates[id]; }
            }
        };
    }

    const screens = {
        menu: createMockScreen('menu'),
        gameModeSelect: createMockScreen('gameModeSelect'),
        nameEntry: createMockScreen('nameEntry'),
        hud: createMockScreen('hud'),
        // ... more screens
    };

    it('should show only the requested screen', () => {
        showScreen('menu');
        expect(screens.menu.classList.contains('hidden')).toBe(false);
        expect(screens.gameModeSelect.classList.contains('hidden')).toBe(true);
    });
});
```

**Test suites:**
- **Screen Management** — 5 tests: screen visibility toggling, transitions between states
- **Button IDs** — 2 tests: required button IDs documented, all unique
- **Settings Controls** — 4 tests: 21 configurable settings exist, gameplay settings present, power-up rates present
- **Gameplay Constants** — 5 tests: win condition (3 rounds), countdown duration, round delay, collision cooldown, delta cap
- **Online Multiplayer** — 3 tests: online state object, max 2 players per game

**Key patterns:**
- Mocked DOM elements and classList behavior
- Pure data structure validation (checking array lengths, unique values)
- Constants validation (value ranges, conditions)

## Test Coverage Analysis

**What IS tested:**
- ✓ Game state machine transitions (`setGameMode`, `startGame`, `endRound`)
- ✓ Score tracking and win condition (3-round threshold)
- ✓ Settings persistence structure (21 configurable settings exist)
- ✓ UI screen visibility and transitions
- ✓ Data structure integrity (button IDs unique, required fields present)
- ✓ Gameplay constants (win condition=3, countdown=3s, collision cooldown=0.5s)
- ✓ Online multiplayer state shape

**What IS NOT tested (critical gaps):**
- ✗ Physics simulation (Rapier3D rigid body behavior, collisions) — `src/physics.js`
- ✗ Player movement and update logic — `src/entities/Player.js`
- ✗ Arena tile destruction and effects — `src/entities/Arena.js`
- ✗ Particle system emission and updates — `src/entities/ParticleSystem.js`
- ✗ Power-up application and removal — `src/entities/Player.js`
- ✗ Input mapping (keyboard, gamepad, touch) — `src/input.js`
- ✗ Renderer engine (Three.js, post-processing bloom) — `src/renderer.js`
- ✗ Audio Web Audio API generation — `src/audio.js`
- ✗ AI Controller tactical behavior — `src/ai/AIController.js`
- ✗ localStorage persistence (no mock of localStorage)
- ✗ Network/WebSocket handling — `src/online.js`
- ✗ Pure utility functions (hex math) — `src/utils/math.js`
- ✗ Integration tests (multiple systems together)
- ✗ E2E tests (browser automation)

**Coverage estimate:** ~20-25% (only state machine and data structure validation)

**Testable low-hanging fruit:**
- `src/utils/math.js` — all hex coordinate functions are pure and easily testable
- `src/store.js` with localStorage mock — all state transitions
- Physics functions with Rapier mocking — possible via `@dimforge/rapier3d-compat`

## Testing Difficulty by Module

**Hard (tightly coupled to browser APIs and global state):**
- `src/main.js` — game loop, initialization, DOM manipulation, state orchestration
- `src/renderer.js` — Three.js WebGL context, post-processing EffectComposer setup
- `src/audio.js` — AudioContext, Web Audio API, dynamic synthesis
- `src/input.js` — window.navigator.getGamepads(), keyboard/touch events
- `src/online.js` — WebSocket connection, network state

**Medium (external dependencies + global objects):**
- `src/entities/Player.js` — depends on physics world (`world` from `src/physics.js`), scene object
- `src/entities/Arena.js` — depends on physics world, scene, tile geometry caching
- `src/entities/ParticleSystem.js` — depends on scene, shader compilation
- `src/ai/AIController.js` — pure logic but requires position/distance calculations

**Easy (pure functions, no side effects):**
- `src/utils/math.js` — all hex coordinate functions are pure and mathematical
  - `hexToPixel(q, r, size)` → converts hex to pixel coordinates
  - `pixelToHex(x, z, size)` → converts pixel to hex (with rounding)
  - `hexRound(hex)` → rounds hex coordinates
  - `generateHexGrid(radius)` → generates ring of hexes
  - `hexDistance(a, b)` → calculates hex distance
  - `hexNeighbor(hex, direction)` → returns adjacent hex

**Testable with mocking:**
- `src/store.js` state actions — require localStorage mock (currently untested)
- `src/physics.js` initialization — require Rapier WASM mock (possible via `@dimforge/rapier3d-compat`)

## Recommended Testing Strategy

### Phase 1: Low-friction additions (immediate)

Add unit tests for pure functions in `src/utils/math.js`:
```bash
tests/utils/math.test.js  # 20-30 assertions, 5-10 tests
```

Example test:
```js
import { describe, it, expect } from 'vitest';
import { hexToPixel, pixelToHex, hexDistance } from '../../src/utils/math.js';

describe('Hex Math Utilities', () => {
    describe('hexToPixel', () => {
        it('should convert hex coordinates to pixel coordinates', () => {
            const result = hexToPixel(0, 0, 1);
            expect(result.x).toBeCloseTo(0, 5);
            expect(result.z).toBeCloseTo(0, 5);
        });

        it('should handle non-zero hex coordinates', () => {
            const result = hexToPixel(1, 0, 1);
            expect(result.x).toBeCloseTo(1.5, 5);
        });
    });

    describe('pixelToHex', () => {
        it('should reverse hexToPixel', () => {
            const size = 1;
            const hex = { q: 3, r: -2 };
            const pixel = hexToPixel(hex.q, hex.r, size);
            const converted = pixelToHex(pixel.x, pixel.z, size);
            expect(converted.q).toBe(hex.q);
            expect(converted.r).toBe(hex.r);
        });
    });

    describe('hexDistance', () => {
        it('should calculate distance between two hexes', () => {
            expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
            expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
        });
    });
});
```

### Phase 2: Component-level tests (medium effort)

Add tests for `src/store.js` with localStorage mock:
```bash
tests/store.test.js  # Expand existing file
```

Example:
```js
import { beforeEach, afterEach, vi } from 'vitest';

describe('Store Persistence', () => {
    let store;
    let mockLocalStorage;

    beforeEach(() => {
        mockLocalStorage = {
            data: {},
            getItem: vi.fn((key) => mockLocalStorage.data[key] || null),
            setItem: vi.fn((key, value) => { mockLocalStorage.data[key] = value; }),
            clear: vi.fn(() => { mockLocalStorage.data = {}; })
        };
        Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
        
        store = createTestStore();
    });

    it('should save settings to localStorage on updateSetting', () => {
        store.getState().updateSetting('sphereSize', 3.0);
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
        const saved = JSON.parse(mockLocalStorage.data['dropfall_settings']);
        expect(saved.sphereSize).toBe(3.0);
    });
});
```

### Phase 3: Integration tests (high effort)

Test multi-system interactions with mocked WebGL/Audio:
```bash
tests/integration/physics-and-rendering.test.js
tests/integration/game-flow.test.js
```

Would require:
- Mocking `THREE.WebGLRenderer`
- Mocking `RAPIER` physics
- Mocking `AudioContext`

### Phase 4: E2E tests (future)

For browser-based end-to-end testing, consider:
- Playwright or Cypress
- Target: `npm run preview` (production build)
- Test full game flow: menu → game mode → gameplay → scoring

## Testing Best Practices (Observed)

When adding new tests, follow these patterns:

**Isolation:**
- Use `beforeEach` to reset state
- Create fresh store/mock objects per test
- Don't reuse module state between tests

**Clarity:**
- Use descriptive test names: `it('should transition to DIFFICULTY_SELECT for 1P mode', ...)`
- Organize tests into logical `describe` blocks
- One assertion per test (or logically related group)

**Maintainability:**
- Extract common setup into helper functions
- Use `vi.fn()` for spies and mocks
- Keep tests close to source files (in same directory or adjacent)

**Coverage targets:**
- Pure functions: aim for 100%
- Store actions: aim for 90%+ (cover all state transitions)
- Components with side effects: 60-70% (selective coverage of critical paths)

## Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# View coverage (when configured)
npm test -- --coverage
```

Test output format:
```
 PASS  tests/ui.test.js (19 tests) 7ms
 PASS  tests/store.test.js (15 tests) 7ms

 Test Files  2 passed (2)
      Tests  34 passed (34)
   Duration  963ms
```

---

*Testing analysis: 2026-03-28*
