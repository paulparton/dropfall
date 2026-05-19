# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:** None. No test framework is installed or configured.

**Assertion Library:** None.

**Test files found:** Zero `.test.js` or `.spec.js` files in `src/`.

**Test scripts:** No `test` script in `package.json`.

```json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
}
```

## Visual Smoke Test File

`src/sdf/test-main.js` exists as a manual browser-run visual test for the SDF renderer subsystem. It is not an automated test — it is a Vite entry point that renders a shader quad in-browser and logs to the console:

```js
console.log('%c=== SDF TEST START ===', 'color: cyan; font-weight: bold;');
// Spins up a Three.js scene, loads a custom GLSL shader, and runs an animation loop
// with frame-count logging every N frames
```

This file is loaded via `index-sdf.html` for manual verification — it is not invoked by any test runner.

## Manual Testing Approach

The project relies entirely on manual in-browser testing:

1. **`npm run dev`** — starts Vite dev server; developer loads the game in a browser.
2. **Browser DevTools** — runtime errors are observed in the console.
3. **`window.dropfallDebug`** — a debug handle exposed at module level in `src/sdf/main.js` for live inspection of game state.
4. **`consoleerrors.log`** — a file at the workspace root indicating manually collected console error output has been captured at some point during development.
5. **`PERFORMANCE_OPTIMIZATION_SPEC.md`** — a spec document describing performance targets and manual profiling steps; no automated performance regression is wired up.

## What Is Tested

No automated coverage exists. The following behaviours are only verifiable manually:

- Physics simulation correctness (Rapier3D integration)
- Player movement and boost mechanics
- Arena tile destruction sequencing
- Power-up application and removal
- Renderer post-processing (bloom, shadows)
- Gamepad connectivity and input polling
- Audio Web Audio API generation
- localStorage settings persistence

## Test Coverage

**Automated:** 0%

**Manual touchpoints:**
- Game runs in browser without JS errors
- Two players can join with keyboard and/or gamepad
- Tiles fall and are removed from physics world correctly
- Round-over and score screen transitions work
- Settings panel reads/writes `localStorage` correctly
- Mobile vs. desktop rendering branches behave as expected

## Adding Tests — Recommended Approach

Because the codebase uses ES modules, Vite, and has no DOM-agnostic logic currently separated, the lowest-friction testing path is **Vitest** (same config as Vite, zero extra setup):

```bash
npm install -D vitest
```

Add to `package.json`:
```json
"scripts": {
    "test": "vitest"
}
```

**Testable in isolation today (pure functions, no DOM/WebGL):**
- `src/utils/math.js` — `hexToPixel`, `pixelToHex`, `hexRound`, `generateHexGrid`, `hexDistance`, `hexNeighbor`
- `src/store.js` — `updateSetting`, `resetSettings`, `setPlayerNames`, state transition actions (requires mocking `localStorage`)

**Requires mocking (DOM/WebGL/AudioContext):**
- `src/renderer.js` — needs Three.js WebGL context mock
- `src/audio.js` — needs `AudioContext` mock
- `src/physics.js` — needs Rapier WASM init (possible with `@dimforge/rapier3d-compat` in Node)

## Test File Placement Convention (if added)

When adding tests, co-locate them with the source file:

```
src/utils/math.js
src/utils/math.test.js

src/store.js
src/store.test.js
```

Use `.test.js` suffix (not `.spec.js`) to match the most common Vitest/Jest convention.

---

*Testing analysis: 2026-03-19*
