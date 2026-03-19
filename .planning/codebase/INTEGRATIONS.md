# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

None detected. This is a fully self-contained browser game with no external API calls, network requests, or third-party services.

## Data Storage

**Databases:**
- None — no backend database

**Local Persistence:**
- `localStorage` (browser-native)
  - `dropfall_settings` — serialized JSON of all game settings (sphere size, volumes, controls, theme, power-up rates, etc.)
  - `dropfall_p1name` — Player 1 display name
  - `dropfall_p2name` — Player 2 display name
  - Read on startup in `src/store.js`, written on settings change

**File Storage:**
- Local filesystem only — all assets are generated procedurally in-code (textures generated via `canvas.getContext('2d')` in `src/utils/textures.js`, `src/utils/themeTextures.js`)

**Caching:**
- None beyond browser-native caching of static assets

## Authentication & Identity

**Auth Provider:**
- None — no user accounts, no authentication

## Audio

**Audio Engine:**
- Web Audio API (browser-native — `window.AudioContext` / `window.webkitAudioContext`)
- No third-party audio library
- All music and SFX are procedurally synthesized via `OscillatorNode`, `GainNode`, `BiquadFilterNode` in `src/audio.js`
- No audio file assets (`.mp3`, `.ogg`, etc.)

## Input Devices

**Gamepad API:**
- Web Gamepad API (browser-native)
- `window.addEventListener('gamepadconnected')` / `gamepaddisconnected`
- `navigator.getGamepads()` polling loop in `src/input.js`
- Supports up to 2 simultaneous gamepads

## WebAssembly

**Rapier Physics (WASM):**
- `@dimforge/rapier3d-compat` ships a WASM binary bundled via npm
- Loaded via async `RAPIER.init()` in `src/physics.js`
- No external CDN fetch — resolved from `node_modules` at build time by Vite

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- `console.log` only (gamepad connect/disconnect events)
- `consoleerrors.log` file present in repo root (21MB — appears to be a captured debug session log, not a runtime integration)

## CI/CD & Deployment

**Hosting:**
- No deployment configuration detected
- Designed for static file hosting (output: `dist/`)
- `game_start.bat` suggests local Windows launch via browser

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- None — no environment variables used at any level

**Secrets:**
- None — no API keys, tokens, or credentials required

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## CDN & External Resources

**Fonts/Icons:**
- None detected in `index.html` — no Google Fonts, no icon CDN links
- Uses system monospace fonts (`'Courier New', monospace`) in `src/style.css`

**External Scripts:**
- None — all dependencies bundled via Vite

---

*Integration audit: 2026-03-19*
