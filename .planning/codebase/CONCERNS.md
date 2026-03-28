# Codebase Concerns

**Analysis Date:** 2026-03-28

## Duplicate Renderer Architectures

**Two completely separate game stacks exist in parallel:**
- Issue: `src/main.js` + `src/renderer.js` (active Three.js game) and `src/sdf/` (ray-marching game) are both shipped, each with its own entry point, physics module, game engine, and main loop
- Files: `index.html`, `index-sdf.html`, `src/main.js`, `src/sdf/main.js`, `src/renderer.js`, `src/sdf/renderer.js`, `src/physics.js`, `src/sdf/physics.js`
- Impact: Maintenance burden doubled. Game logic changes must be replicated in both. Features unique to Three.js stack (themes, power-up showcase, presets, autorestart) never ported to SDF
- Fix approach: Decide which renderer to keep. Remove the other or establish SDF as explicit future milestone

---

## Tech Debt

**Monolithic Main Module (990 lines):**
- Issue: `src/main.js` contains game loop, UI handlers, state management, entity lifecycle, and event listeners mixed together
- Files: `src/main.js`
- Impact: Difficult to test, maintain, and debug. High cognitive load for onboarding
- Fix approach: Extract into separate modules: gameLoop.js, uiHandlers.js, gameStateController.js, entityManager.js

**Excessive Global State Exposure:**
- Issue: Functions and objects exposed on `window`: `window.dropfallDebug`, `window.POWER_UP_EFFECTS`, `window.__RAPIER_WORLD__`, `window.__RAPIER_INITIALIZED__`
- Files: `src/main.js` (lines 79-80), `src/sdf/main.js` (lines 397-410), `src/physics.js` (lines 11-12)
- Impact: Makes debugging harder to reason about. Global pollution risks conflicts with other libraries
- Fix approach: Use module exports/imports instead. Create dedicated Debug namespace if needed. Import RAPIER through module pattern

**Missing Input Validation and Sanitization:**
- Issue: User input (player names, preset names) used directly in HTML without sanitization. Names truncated but not sanitized for special characters
- Files: `src/main.js` (lines 115-118, 495, 578, 630, 775-778)
- Impact: Potential XSS vulnerability if user enters malicious content
- Fix approach: Use `textContent` instead of `innerHTML`. Sanitize names with DOMPurify or manual strip function

**Unguarded localStorage Access:**
- Issue: Direct `localStorage.getItem()` and `localStorage.setItem()` without try-catch. localStorage can throw if disabled, quota exceeded, or in private mode
- Files: `src/main.js` (lines 493, 510, 523, 534), `src/store.js` (line 35)
- Impact: Silent failures on protected browsers. Presets/settings silently lost
- Fix approach: Wrap all localStorage calls in try-catch. Provide fallback to in-memory only when unavailable

**Minimal Error Handling:**
- Issue: Only 4 catch blocks in entire codebase. No handling for WebGL context loss, physics init failure, audio context failure, renderer DOM errors
- Files: Throughout codebase, notably missing in `src/renderer.js`, `src/sdf/renderer.js`
- Impact: Silent failures. Game may appear frozen with no error messages
- Fix approach: Add try-catch wrappers around initialization. Add error boundaries in UI. Log and display user-friendly errors

**Console Spam in Production:**
- Issue: 30+ `console.log()` statements throughout codebase including connection logs, state changes, and frame info
- Files: `src/main.js`, `src/input.js`, `src/online.js`, `src/sdf/main.js`
- Impact: Confusing logs for end users. Makes real errors harder to spot
- Fix approach: Create debug flag in store. Use conditional logging. Remove frame-level logs

---

## Security Considerations

**XSS Risk via innerHTML:**
- Risk: Direct `innerHTML` assignment with user data and interpolated strings
- Files: `src/main.js` (lines 495, 576, 578, 600, 630, 638, 645, 775-778), `src/sdf/main.js` (line 336)
- Current mitigation: Data stored in localStorage (local machine only). No backend validation
- Recommendations: 
  1. Use `textContent` for user names and scores instead of `innerHTML`
  2. For complex HTML, use sanitization library
  3. Validate all user input on backend before echoing in online

**WebSocket Connection Without Validation:**
- Risk: WebSocket connection to arbitrary user-supplied server URL. No SSL pinning or certificate verification
- Files: `src/online.js` (lines 15-26), `src/main.js` (line 538)
- Current mitigation: HTTPS enforcement via `wss:` protocol selection
- Recommendations:
  1. Allow only `wss://` (secure WebSocket) for production
  2. Validate server URL against whitelist
  3. Add connection timeout
  4. Add rate limiting on reconnect attempts

**No Authentication/Authorization:**
- Risk: Any player can connect and play. No token validation or identity verification
- Files: `src/online.js`, online connection flow in `src/main.js`
- Current mitigation: None (by design for casual game)
- Recommendations:
  1. Add player ID/session token validation if moving to production
  2. Rate limit connections per IP
  3. Add server-side player state validation

**Unprotected Sensitive Data in Messages:**
- Risk: Player input, position, and game state sent over WebSocket without app-layer encryption
- Files: `src/online.js` (lines 80-95)
- Current mitigation: HTTPS/WSS transport encryption only
- Recommendations:
  1. Add app-layer encryption for sensitive data
  2. For competitive games, add replay validation server-side
  3. Never send critical game state to client - validate server-side

---

## Performance Bottlenecks

**Audio Synthesis CPU Cost:**
- Problem: Real-time audio synthesis generating instruments every frame during music playback
- Files: `src/audio.js` (lines 43-100+)
- Cause: Complex waveform generation runs in game loop
- Improvement path: 
  1. Pre-generate audio buffers instead of real-time synthesis
  2. Use Web Audio API's built-in oscillators more efficiently
  3. Move tempo scaling to audio context rate (not frame-based)

**Physics Accumulator May Drop Frames:**
- Problem: Physics accumulator capped at 0.1s but can still cause jank if frame time exceeds threshold
- Files: `src/physics.js` (lines 30-40)
- Cause: When tab is backgrounded or CPU is busy, delta can be large, causing catch-up frames
- Improvement path:
  1. Consider fixed timestep separate from render loop
  2. Add frame skip logic instead of accumulation
  3. Log frame drops for profiling

**Shader Compilation at Runtime:**
- Problem: Full ray-marching shader compiled on every scene init in SDF mode
- Files: `src/sdf/renderer.js` (lines 16-20, shader inline)
- Cause: No pre-compilation or caching of shader programs
- Improvement path:
  1. Pre-compile shaders at build time if possible
  2. Cache compiled programs
  3. Show loading indicator during compilation

**Large Monolithic Shader Files:**
- Problem: `ray-march.glsl` (409 lines) and `sdf-functions.glsl` (206 lines) included inline, not modular
- Files: `src/sdf/ray-march.glsl`, `src/sdf/sdf-functions.glsl`
- Cause: Difficult to profile which part is slow. No code reuse
- Improvement path:
  1. Break shader into include modules
  2. Profile with WebGL profilers
  3. Consider async compilation with fallback

---

## Browser Compatibility Issues

**Audio Context Polyfill Limited:**
- Issue: Uses `window.webkitAudioContext` fallback but webkit support varies across browsers
- Files: `src/audio.js` (line 28)
- Affected: Older Chrome, Safari, mobile browsers
- Fix: Test on real devices; consider tone.js or similar library

**Gamepad API Inconsistency:**
- Issue: Gamepad API implementation varies. Some don't support all button/axis counts
- Files: `src/input.js` (lines 35-47)
- Affected: Safari, older Firefox, some mobile browsers
- Current mitigation: Polling with error catching
- Fix: Add feature detection for standardized vs vendor-specific mapping

**WebGL Shader Version Mismatch:**
- Issue: Ray-march shader uses GLSL without explicit version. Mobile browsers may default to older GLSL
- Files: `src/sdf/ray-march.glsl`
- Affected: Low-end Android, iOS with older webkit
- Fix: Add `#version 300 es` and test on target devices

**Mobile Pixel Ratio Handling:**
- Issue: Mobile pixel ratio capped at 1.0, but some densities may still cause memory issues
- Files: `src/renderer.js` (line 48)
- Concern: Edge devices with extreme DPI may OOM
- Fix: Add device profiling; consider adaptive resolution

**Storage Private/Incognito Mode:**
- Issue: localStorage throws in private browsing mode on some browsers
- Files: `src/main.js`, `src/store.js`
- Affected: Safari private mode, Firefox private browsing
- Current mitigation: None
- Fix: Wrap in try-catch; detect and warn user

---

## Missing Critical Features

**No Connection Dropout Recovery:**
- Problem: WebSocket disconnect does not auto-reconnect during gameplay. Player forced back to menu
- Files: `src/online.js` (lines 48-54)
- Impact: Frustrating UX if network hiccup occurs mid-game
- Fix: Implement exponential backoff reconnect with pause-and-resume

**No Replay System:**
- Problem: No way to record or playback games for competitive verification or debugging
- Impact: Hard to verify fair play or debug sync issues
- Fix: Record input sequence + timestamps; store locally; replay deterministically

**No Graceful Degradation:**
- Problem: If WebGL unavailable, no canvas fallback or 2D renderer
- Impact: Game completely broken on unsupported browsers
- Fix: Add 2D context check; fallback to simpler game mode or message

---

## Fragile Areas

**Game State Transition Logic:**
- Files: `src/main.js` (lines 290-350, state machine in game loop)
- Why fragile: Complex nested switch statements. Race conditions possible if events fire during transitions
- Safe modification: Document all valid paths. Add guards preventing invalid transitions
- Test coverage: Minimal - none for state transitions

**Entity Cleanup Resource Leaks:**
- Files: `src/main.js` (lines 161-162, 185-188, 227-229)
- Why fragile: Uses optional chaining (`?.cleanup()`) without guarantees. Geometry/material disposal may be incomplete
- Safe modification: Create base Entity class with guaranteed cleanup. Verify all disposables called
- Test coverage: No tests; manual verification only

**Renderer Initialization Can Fail Silently:**
- Files: `src/renderer.js` (lines 37-44)
- Why fragile: If `#app` div not found, falls back to `document.body.appendChild()`. Game may render in unexpected container
- Safe modification: Throw error if container not found. Require explicit element
- Test coverage: Manual only

**Physics World Global State:**
- Files: `src/physics.js` (lines 9-15)
- Why fragile: `window.__RAPIER_WORLD__` shared across multiple instantiations. Multiple games created could collide
- Safe modification: Move RAPIER world to proper module singleton. Add cleanup
- Test coverage: None

**Online State Synchronization:**
- Files: `src/online.js`, online flow in `src/main.js`
- Why fragile: Manual state sync between client and server. Many race conditions
- Safe modification: Implement CRDT or operational transformation. Centralize authority server-side
- Test coverage: None - no online integration tests

---

## Test Coverage Gaps

**No Unit Tests for Core Systems:**
- Untested: Game state transitions, physics detection, player input, power-ups, AI logic
- Files: `src/main.js`, `src/input.js`, `src/entities/Player.js`, `src/ai/AIController.js`, `src/physics.js`
- Risk: **HIGH** - core gameplay can break without detection
- Priority: **HIGH**

**No Integration Tests:**
- Missing: Game loop + entities, online multiplayer scenarios, renderer + physics sync
- Risk: **HIGH** - integration issues undetected
- Priority: **HIGH**

**Existing Coverage:**
- Files: `tests/store.test.js`, `tests/ui.test.js` (minimal)
- Status: Only tests store and UI in isolation; no game logic

---

## Known Bugs

**SDF Renderer Non-Functional:**
- Issue: Ray-marching shader outputs UV gradient test pattern, not rendered scene. Dead code in `sceneSDF()`, `rayMarch()`, `calcNormal()`
- Files: `src/sdf/renderer.js` (lines ~200–240)
- Impact: `index-sdf.html` renders color-gradient quad, not game
- Fix: Implement `main()` GLSL function to call `rayMarch()` → `calcNormal()` → `phongLighting()`

**`src/sdf/test-main.js` Debug Artefact:**
- Issue: Test harness appends "🔵 SDF SYSTEM ACTIVE 🔵" banner to document.body
- Files: `src/sdf/test-main.js` (line 11)
- Fix: Delete or gitignore before production

**`updateArenaUniforms` Wrong Uniform:**
- Issue: Sets `uArenaPrimaryColor` twice instead of once for each color
- Files: `src/sdf/renderer.js`
- Fix: Change second assignment to `uArenaSecondaryColor`

**Duplicate shadowMap Assignment:**
- Issue: Lines 37–38 of `src/renderer.js` assign `renderer.shadowMap.resolution` twice
- Files: `src/renderer.js` (lines 37-38)
- Fix: Delete duplicate line

**Window POWER_UP_EFFECTS Unused:**
- Issue: `window.POWER_UP_EFFECTS = null` never assigned, making global pointless
- Files: `src/main.js` (line ~42)
- Fix: Remove the line entirely

---

## Scaling Limits

**Max Concurrent Online:**
- Current capacity: Unknown (no server limits documented)
- Depends on: Server implementation, database capacity
- Scaling path: Load balancing, session management, persistent storage

**Physics Simulation:**
- Current limit: 2 players + arena tiles + particles at 60 FPS on modern devices
- Bottleneck: Adding entities (>2P) degrades performance
- Scaling path: Spatial partitioning, object pooling, entity count reduction

**Texture Memory:**
- Current concern: Multiple theme textures loaded, not atlased
- Risk: VRAM exhaustion on low-end devices
- Scaling path: Texture atlasing, lazy loading by theme

---

## Dependencies at Risk

**Three.js Version Not Pinned:**
- Risk: Implicit dependency on unspecified version
- Impact: Future NPM install may pull incompatible version
- Fix: Pin Three.js in package.json; test upgrades

**Rapier3D Physics:**
- Risk: Maintained externally; upgrades may require code changes
- Impact: Collision or physics behavior may change
- Fix: Test physics simulation after upgrading; document parameters

---

## Documentation Gaps

**Physics Parameters Not Explained:**
- Missing: What does gravity -20.0 mean? Why restitution 0.9?
- Files: `src/physics.js`
- Impact: Tweaking requires trial-and-error

**Shader Math Undocumented:**
- Missing: How does ray-march work? What's the SDF?
- Files: `src/sdf/ray-march.glsl`, `src/sdf/sdf-functions.glsl`
- Impact: Hard to debug visual artefacts

**Store Actions Not Documented:**
- Missing: List of all `useGameStore` actions and side effects
- Files: `src/store.js`
- Impact: Developers guess at action names

**Online Protocol Undocumented:**
- Missing: What messages sent? What's handshake? Collision handling?
- Files: `src/online.js`
- Impact: Hard to implement server or debug protocol

---

*Concerns audit: 2026-03-28*
