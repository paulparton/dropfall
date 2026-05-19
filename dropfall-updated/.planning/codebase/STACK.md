# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- JavaScript (ES2022+) - All game logic, rendering, physics, audio, input (`src/`)
- GLSL - Custom ray-marching and SDF shaders (`src/sdf/ray-march.glsl`, `src/sdf/sdf-functions.glsl`)

**Secondary:**
- HTML5 - Entry point and UI overlay (`index.html`, `index-sdf.html`)
- CSS3 - Retro/cyberpunk UI styling (`src/style.css`)

## Runtime

**Environment:**
- Browser (Web platform — no Node.js runtime at game execution)
- Targets modern browsers with WebGL2 support

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — vanilla JavaScript, no application framework (React, Vue, etc.)

**3D Rendering:**
- Three.js `^0.183.1` — WebGL scene graph, camera, lighting, shadows, geometry
  - Used in `src/renderer.js`, `src/entities/`, `src/sdf/renderer.js`
  - Three.js addons used: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` (post-processing pipeline)
  - Renderer config: `WebGLRenderer` with `PCFSoftShadowMap`, `ReinhardToneMapping`

**Physics:**
- `@dimforge/rapier3d-compat` `^0.19.3` — Rapier 3D physics engine (WASM)
  - Used in `src/physics.js`
  - Init pattern: async `RAPIER.init()` before `World` construction
  - Custom gravity: `{ x: 0, y: -20, z: 0 }`
  - Fixed timestep: 1/60s desktop, 1/30s mobile

**State Management:**
- Zustand `^5.0.11` (vanilla store, no React binding)
  - Used via `zustand/vanilla` `createStore` in `src/store.js`
  - All modules import `useGameStore` for shared game state

**Testing:**
- None detected

**Build/Dev:**
- Vite `^7.3.1` — dev server, HMR, ES module bundling, production build

## Key Dependencies

**Critical:**
- `three` `^0.183.1` — entire 3D rendering pipeline
- `@dimforge/rapier3d-compat` `^0.19.3` — WASM physics; async init required before game start
- `zustand` `^5.0.11` — global game state across all modules

**Infrastructure:**
- `vite` `^7.3.1` (devDependency) — build toolchain and dev server

## Configuration

**Environment:**
- No `.env` files detected
- No environment variables required — fully client-side game
- Player settings persisted via `localStorage` keys: `dropfall_settings`, `dropfall_p1name`, `dropfall_p2name`

**Build:**
- No `vite.config.*` file — uses Vite defaults
- `package.json` `"type": "module"` — native ES module project

**Mobile Adaptive:**
- Runtime device detection via `navigator.userAgent` and `window.innerWidth < 768`
- Mobile path: bloom disabled, pixel ratio capped at 1.0, physics at 30fps, lower shadow resolution

## Platform Requirements

**Development:**
- Node.js (for `npm install` and `vite` dev server)
- Modern browser with WebGL2 and WebAssembly support

**Production:**
- Static file hosting only — no server required
- Built output: `dist/` directory (standard Vite output)
- Launch scripts: `game_start.bat` (Windows) — suggests local file serving via browser

---

*Stack analysis: 2026-03-19*
