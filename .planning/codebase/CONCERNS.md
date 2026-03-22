# Codebase Concerns

**Analysis Date:** 2026-03-19

---

## Duplicate Renderer Architectures

**Two completely separate game stacks exist in parallel:**
- Issue: `src/main.js` + `src/renderer.js` (active Three.js game) and `src/sdf/` (ray-marching game) are both shipped, each with its own entry point (`index.html` vs `index-sdf.html`), physics module, game engine, and main loop.
- Files: `index.html`, `index-sdf.html`, `src/main.js`, `src/sdf/main.js`, `src/renderer.js`, `src/sdf/renderer.js`, `src/physics.js`, `src/sdf/physics.js`
- Impact: Maintenance burden is doubled. Any game logic change (win conditions, name entry, settings, boosts) must be replicated in both stacks. Features unique to the Three.js stack (themes, power-up UI showcase, preset system, autorestart, gamepad menu nav) were never ported to SDF.
- Fix approach: Decide which renderer to keep and remove the other, or establish the SDF path as an explicit future milestone and clearly mark it as non-functional.

---

## SDF Renderer Is Non-Functional (Test Stub)

**The SDF ray-marching shader outputs a static UV gradient, not a rendered scene:**
- Issue: The GLSL `main()` in `src/sdf/renderer.js` contains only `vec3 color = vec3(uv, 0.5); gl_FragColor = vec4(color, 1.0)` — a test pattern. The fully-defined functions `rayMarch()`, `calcNormal()`, `phongLighting()`, `calcShadow()`, and `sceneSDF()` are all dead code. The `uTileStates` uniform is allocated but never populated.
- Files: `src/sdf/renderer.js` (lines ~200–240)
- Impact: `index-sdf.html` renders a colour-gradient fullscreen quad, not a game. Players can control physics but nothing is visible.
- Fix approach: Implement the `main()` GLSL function to call `rayMarch()` → `calcNormal()` → `phongLighting()`, and feed `uTileStates` from `game-engine.js`.

**`src/sdf/test-main.js` is a debug artefact shipped to production:**
- Issue: `src/sdf/test-main.js` appends a visible "🔵 SDF SYSTEM ACTIVE 🔵" banner to `document.body` and exposes `window.sdfTest`. It is a test harness, not game code.
- Files: `src/sdf/test-main.js`
- Fix approach: Delete or gitignore before any production build.

---

## Known Bugs

**`updateArenaUniforms` writes secondary colour to wrong uniform:**
- Issue: In `src/sdf/renderer.js`, the `updateArenaUniforms()` function sets `uArenaPrimaryColor` twice and never sets `uArenaSecondaryColor`. Line `sdfShaderMaterial.uniforms.uArenaPrimaryColor.value.setHex(secondaryColor)` should reference `uArenaSecondaryColor`.
- Files: `src/sdf/renderer.js` (`updateArenaUniforms`)
- Impact: Arena secondary colour is always wrong in the SDF renderer.
- Fix approach: Change the second line to `sdfShaderMaterial.uniforms.uArenaSecondaryColor.value.setHex(secondaryColor)`.

**`window.POWER_UP_EFFECTS = null` is never set:**
- Issue: `src/main.js` sets `window.POWER_UP_EFFECTS = null` with a comment saying it will be set after Player import, but it is never assigned. The power-ups showcase in `init()` correctly uses the ES module import directly, making this global pointless.
- Files: `src/main.js` (line ~42)
- Fix approach: Remove the `window.POWER_UP_EFFECTS = null` line entirely.

**`renderer.shadowMap.resolution` is assigned twice consecutively:**
- Issue: Lines 37–38 of `src/renderer.js` set `renderer.shadowMap.resolution = shadowResolution` back-to-back with no logic between them.
- Files: `src/renderer.js` (lines 37–38)
- Fix approach: Delete the duplicate line.

**`sdfRaycast` callback returns no value:**
- Issue: In `src/sdf/physics.js`, the `world.castRay(...)` callback ends with a bare `true;` statement rather than `return true;`. This means RAPIER may not correctly terminate ray traversal.
- Files: `src/sdf/physics.js` (`sdfRaycast`)
- Fix approach: Change `true;` to `return true;`.

**`SDF ROUND_OVER` handler fires `handleGameOver()` every animation frame:**
- Issue: In `src/sdf/main.js`, the `gameLoop` switch handles `ROUND_OVER` with `if (storeState.p1Score >= 3 ...) handleGameOver()` but no guard prevents this from repeating on every frame until state changes.
- Files: `src/sdf/main.js` (gameLoop switch, `ROUND_OVER` case)
- Fix approach: Track a `gameOverHandled` flag, or transition game state to `GAME_OVER` inside `handleGameOver()` before rendering UI.

---

## Tech Debt

**`isMobileDevice()` function triplicated:**
- Issue: Identical implementations exist in `src/renderer.js`, `src/physics.js`, and `src/entities/ParticleSystem.js`. They also have a minor inconsistency (`ipot` typo in `src/physics.js` line 8 vs `ipod` in the others).
- Files: `src/renderer.js`, `src/physics.js`, `src/entities/ParticleSystem.js`
- Impact: A typo in one copy (`ipot`) may cause wrong mobile detection on iPod Touch.
- Fix approach: Move to `src/utils/math.js` or a new `src/utils/device.js` and import everywhere.

**`isMobile` evaluated at module load time in `src/physics.js`:**
- Issue: `const isMobile = isMobileDevice()` is a module-level constant. If the page loads in portrait narrow width (<768px) then resizes to landscape (>768px), the physics timestep will remain at mobile 1/30 for the session.
- Files: `src/physics.js` (line ~38)

**Shared Rapier world via `window.__RAPIER_*` globals:**
- Issue: `src/physics.js` uses `window.__RAPIER_INITIALIZED__` and `window.__RAPIER_WORLD__` as init guards so both the Three.js and SDF physics modules share a single RAPIER world. This means both engines modify the same physics world simultaneously if both entry points somehow run, and it couples modules to window state.
- Files: `src/physics.js`
- Fix approach: Use ES module singleton instead of window globals.

**`window.__GAME_INITIALIZED__` guard and `window.showPowerUpNotification`:**
- Issue: `src/main.js` uses window globals for initialization guard (`window.__GAME_INITIALIZED__`) and to expose `showPowerUpNotification` to `Player.js` — a workaround for a circular dependency. `Player.js` should receive a callback via constructor injection instead.
- Files: `src/main.js` (lines ~38–39, 248–249), `src/entities/Player.js`

**`settingsMap` duplicated in both main files:**
- Issue: The `settingsMap` object mapping HTML element IDs to store keys is defined independently in `src/main.js` and `src/sdf/main.js`. SDF version is also missing several keys (`portal-cooldown`, `bonus-duration`, `bloom-level`, `player-aura-*`, `boost-*`).
- Files: `src/main.js`, `src/sdf/main.js`

**`SHARED_TILE_GEOMETRY` is not reset between games:**
- Issue: `src/entities/Arena.js` has `SHARED_TILE_GEOMETRY = null` as a module-level variable. `TILE_MATERIALS_CACHE` is cleared on each Arena construction, but `SHARED_TILE_GEOMETRY` is never reset. If `tileRadius` or `height` changes between Arena instances (not currently possible but fragile), stale geometry persists.
- Files: `src/entities/Arena.js`

---

## Performance Bottlenecks

**No shadow casting for players (documented but unimplemented):**
- Issue: `todo.md` explicitly calls out missing player shadows. `player.mesh.castShadow = true` is set but the `directionalLight.shadow.camera` frustum only covers ±30 units. At `arenaSize=5`, tiles can be ~40 units from centre, so outer tiles don't receive correct shadows. This also causes performance waste: shadow maps are computed but only cover part of the play field.
- Files: `src/entities/Player.js` (line ~192), `src/renderer.js` (lines 73–81)
- Fix approach: Extend shadow camera bounds to ±50 and verify shadow bias; or switch to `CascadedShadowMap`.

**Mobile performance remains a blocker (documented in todo.md):**
- Issue: `todo.md` states the game is "not playable on a mobile device (iPhone) throughout the game, and any pre/between round loading scenes take ages and are jumpy." The current mitigations (particle cap, bloom removal, lower physics timestep) are insufficient. No LOD, no object pooling for tilefall RAPIER bodies, and canvas-generated 1024×1024 textures rendered per active theme are significant bottlenecks.
- Files: `src/utils/themeTextures.js` (creates four 1024×1024 canvas textures per theme), `src/entities/Arena.js`, `src/physics.js`

**Texture generation is blocking/synchronous:**
- Issue: `src/utils/themeTextures.js` generates multiple 1024×1024 `CanvasTexture` sets (map, bumpMap, emissiveMap, roughnessMap) synchronously on the main thread. On low-end devices this causes the loading freeze noted in `todo.md`.
- Files: `src/utils/themeTextures.js`
- Fix approach: Move texture generation to a Web Worker, or pre-bake textures as static assets.

**`LightningSystem` allocates new `LineBasicMaterial` per bolt segment:**
- Issue: `createStrike()` in `src/entities/LightningSystem.js` creates two `new THREE.LineBasicMaterial(...)` instances per call regardless of the class-level `this.coreMaterial`/`this.glowMaterial` being defined in the constructor. At high collision rates (boosting players) this generates GC pressure.
- Files: `src/entities/LightningSystem.js` (`createStrike`)
- Fix approach: Reuse the constructor materials; vary colour via a separate colour uniform or material clone pool.

**Particle system hard-resets `particleCount = 0` on overflow:**
- Issue: When the 5000-particle buffer fills, `this.particleCount = 0` instantly overwrites index 0, causing a visible flash where old live particles are replaced. The `update()` loop also iterates over all `maxParticles` positions regardless of how many are actually active.
- Files: `src/entities/ParticleSystem.js` (`emit`, `update`)
- Fix approach: Implement a proper ring-buffer with separate read/write pointers, and track the high-water mark for the update loop.

---

## Fragile Areas

**Power-up stacking causes permanent multiplier inflation:**
- Issue: Multiple applications of the same power-up type (e.g. picking up SPEED_DEMON twice) call `apply()` twice setting `sphereAccelMultiplier = 2.0` twice, but each `remove()` sets it back to `1.0`. If the first expires before the second, the player's speed is incorrectly reset to 1.0 while the second power-up is still active.
- Files: `src/entities/Player.js` (`update` — bonus tile logic, `POWER_UP_EFFECTS`)
- Fix approach: Stack effects additively (increment/decrement multipliers) or prevent applying the same type more than once.

**`powerUpColor` reset logic is unreliable:**
- Issue: The filter in the power-up cleanup block checks `this.activePowerUps.length === 1 && this.activePowerUps[0] === powerUp` to decide whether to clear `powerUpColor`. Since `.filter()` evaluates all elements before mutating the array, this condition is evaluated against the pre-filter length, making it unreliable when multiple power-ups expire in the same frame.
- Files: `src/entities/Player.js` (`update` — power-up cleanup block)

**`INVULNERABILITY` power-up prevents player movement:**
- Issue: `hasControl` in `src/entities/Player.js` is false when `isInvulnerable`. This means the FORTRESS power-up removes all player input control in addition to knockback immunity — likely unintended.
- Files: `src/entities/Player.js` (line ~310 `hasControl` definition)
- Fix approach: Separate `isInvulnerable` from the `hasControl` check; only ignore impulse application for knockback, not player-directed input.

**Portal tiles accumulate and are never auto-expired:**
- Issue: `triggerPortal()` in `src/entities/Arena.js` sets `tile.timer = 0` — portals persist indefinitely. The only removal is when a player teleports and `convertTileToNormal()` is called. Over many rounds, nearly all remaining tiles become portals, leaving no NORMAL tiles for the ice/bonus triggers to target.
- Files: `src/entities/Arena.js` (`triggerPortal`, `update`)
- Fix approach: Give portal tiles a finite `timer` (e.g. 15s) and revert to NORMAL on expiry.

**Arena size change not reflected in shadow camera or hex grid spacing:**
- Issue: When `arenaSize` setting changes (range 3–5), the hexagonal grid grows but `directionalLight.shadow.camera` bounds are always ±30 in `src/renderer.js`. At `arenaSize=5` (~40 unit radius), outer tile shadows are clipped. Similarly, collision detection in `src/main.js` uses hardcoded `sphereSize * 2 + 0.1` which doesn't account for themes using different tile spacing.
- Files: `src/renderer.js`, `src/main.js`

**SDF engine `updateCamera` passes plain objects where `THREE.Vector3` is required:**
- Issue: `this.camera.position` and `this.camera.target` in `src/sdf/game-engine.js` are plain JS objects `{x, y, z}`. `SDFRenderer.updateCameraPosition()` calls `camera.position.copy(position)` — `THREE.Vector3.copy()` expects a Vector3, not a plain object.
- Files: `src/sdf/game-engine.js` (`updateCamera`), `src/sdf/renderer.js` (`updateCameraPosition`)
- Impact: Runtime `TypeError` in SDF mode when camera updates are triggered.

---

## Security Considerations

**`localStorage` settings not validated on load:**
- Issue: `src/store.js` merges `localStorage.getItem('dropfall_settings')` directly into settings with `{ ...defaultSettings, ...savedSettings }`. Malformed values (NaN, negative numbers, strings) from tampered or corrupted storage are never sanitised or clamped. A setting like `destructionRate: 0` or `sphereWeight: -1` could break game logic.
- Files: `src/store.js` (lines ~35–40)
- Fix approach: Validate and clamp each numeric setting against known min/max ranges after merge.

**Default presets can be permanently deleted:**
- Issue: `deletePresetFromStorage()` in `src/main.js` deletes any preset by name, including the four shipped defaults (`Balanced`, `Heavy & Slow`, `Light & Fast`, `Arena Chaos`). There is no confirmation and no way to restore them short of clearing all localStorage.
- Files: `src/main.js` (`deletePresetFromStorage`, `updatePresetsUI`)
- Fix approach: Mark default preset names as protected and prevent deletion, or restore defaults from `DEFAULT_PRESETS` on demand.

---

## Missing Features (Documented)

**Shadows for aerial play:**
- `todo.md`: "Make the spheres cast shadows. We have discovered with some settings it is quite easy to get the sphere airborne... shadows will help us orient ourselves from the air."
- Files: `src/entities/Player.js`, `src/renderer.js`
- Current state: Shadow infrastructure exists but frustum too small; no aerial orientation cue.

**Auto-restart exists but lacks per-round trigger:**
- `todo.md`: Auto-restart checkbox is implemented and persisted (see `src/main.js` and localStorage key `dropfall_autorestart`). The GAME_OVER auto-restart after 2s is working. However, `ROUND_OVER` state transitions back to name entry (rather than auto-starting the next round) even when auto-restart is enabled.
- Files: `src/main.js` (ROUND_OVER handler in `useGameStore.subscribe`)

**SDF engine boost meter not synced to HUD:**
- Issue: `player.boostEnergy` is stored locally on the player object in `src/sdf/game-engine.js` and is never written to the Zustand store (`player1Boost`/`player2Boost`). The boost bar in the HUD will always show 0 in SDF mode.
- Files: `src/sdf/game-engine.js` (`updatePlayer`)

**Audio has no `stopMusic()` capability:**
- Issue: `src/audio.js` starts oscillators in a self-scheduling loop. There is no exported `stopMusic()` function and no reference to running oscillators is stored. Background music cannot be stopped, only volume-zeroed via `musicGain.gain.value = 0`.
- Files: `src/audio.js`
- Fix approach: Store all oscillator/timeout references and provide a cleanup path.

---

## Test Coverage Gaps

**No automated tests exist:**
- What's not tested: Physics integration, collision detection, game state transitions, power-up apply/remove, arena tile lifecycle, input mapping, preset save/load.
- Files: Entire codebase — no `*.test.*` or `*.spec.*` files found; no test framework configured in `package.json`.
- Risk: Regressions in physics parameters, power-up interactions, or game flow are silent.
- Priority: High for physics/game-loop logic; Medium for UI/rendering.

---

*Concerns audit: 2026-03-19*
