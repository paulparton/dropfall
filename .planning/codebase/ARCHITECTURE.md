# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Event-driven state machine with layered rendering/physics engine and modular entity systems.

**Key Characteristics:**
- Single-threaded game loop with requestAnimationFrame pacing (60Hz desktop, 30Hz mobile)
- Centralized state management via Zustand store—authoritative source for game state, settings, scores
- Separation of concerns: rendering, physics, input, AI, effects decoupled via store subscriptions and module exports
- Support for three game modes: local 2P, single-player with tactical AI, and online multiplayer (WebSocket-based)
- Physics-driven combat with Rapier3D (3D rigid body dynamics, gravity Y=-20.0, collision bounce 0.9–1.5)
- Procedural particle/lightning/shockwave effects system for visual feedback
- Dual rendering paths: primary Three.js (main.js), experimental SDF ray-marching (src/sdf/)

## Layers

**Presentation (Three.js Rendering):**
- Purpose: Render 3D scene with materials, lighting, post-processing (Unreal Bloom)
- Location: `src/renderer.js`, entity mesh creation in `src/entities/*.js`
- Contains: Scene setup, camera (y:20 z:20 lookAt origin), WebGL config (adaptive antialias/power), bloom pipeline, PCF soft shadows, Reinhard tone mapping
- Depends on: Three.js, `src/utils/themeTextures.js` (materials), `src/store.js` (bloom settings)
- Used by: Main loop calls `updateRenderer()` each frame; entities add meshes to scene
- Mobile: Device detection adaptive—pixel ratio 1.0/2.0, shadow res 512×512/1024×1024, bloom disabled on low-power

**Physics (Rapier3D Rigid Body Dynamics):**
- Purpose: Simulate rigid body collisions, gravity, forces, constraints with deterministic timestep
- Location: `src/physics.js`
- Contains: World init (gravity y:-20), body creation (players/tiles), collision queries, accumulator with fixed timestep
- Depends on: `@dimforge/rapier3d-compat` (WASM physics)
- Used by: Player/tile impulses, collision detection, destruction
- Mobile: 1/30 timestep vs desktop 1/60; reduced solver iterations (2 vs default)

**Entity System (Game Objects):**
- Purpose: Encapsulate player, arena, and effect behaviors with lifecycle (update/cleanup)
- Location: `src/entities/` (Player.js, Arena.js, ParticleSystem.js, LightningSystem.js, ShockwaveSystem.js)
- Contains: Three.js mesh + Rapier physics body linkage per entity; per-object state (position, velocity, health, power-up timers)
- Each entity exports: constructor, update(delta, ...), cleanup(), emit() (for effects systems)
- Depends on: `renderer.js` (scene), `physics.js` (world/factory fns), `store.js` (settings/state), `utils/`
- Used by: Main loop calls update/cleanup; main loop queries positions/states each frame

**State Management (Zustand Store):**
- Purpose: Centralized, persistent store for game state, settings, and player data
- Location: `src/store.js`
- Contains: Game phases (MENU, GAME_MODE_SELECT, DIFFICULTY_SELECT, NAME_ENTRY, COUNTDOWN, PLAYING, ROUND_OVER, GAME_OVER), scores (p1Score, p2Score), player names, settings object (theme, sphereSize, sphereWeight, gravity multipliers, boost regen, particle amount, audio volumes), online connection state, active power-ups
- Exports: `useGameStore` action methods: `startGame()`, `endRound()`, `setDifficulty()`, `updateSetting()`, `setOnlineConnected()`, etc.
- Persistence: localStorage for player names, settings, game mode, difficulty
- Used by: All systems subscribe via `useGameStore.getState()` to read current state or dispatch actions

**Input Handling (Multi-Device):**
- Purpose: Unified input abstraction across keyboard, gamepad, and touch
- Location: `src/input.js`
- Contains: Global `keys` object (keyCode → boolean), gamepad robust polling loop (~12-16ms updates), touch tap detection (screen edge regions for 4-way + center for boost)
- Exports: `getPlayer1Input()`, `getPlayer2Input()` returning `{forward, backward, left, right, boost}` each frame
- Gamepad Fallback: If controller disconnected mid-game, falls back to keyboard; reconnect auto-resumes
- Mobile Detection: Adjusts touch area sizes and polling frequency

**AI Controller (Single-Player NPC):**
- Purpose: Tactical NPC opponent for 1-player mode
- Location: `src/ai/AIController.js`
- Contains: State machine (HUNT, FLANK_CHARGE, PUSH, EDGE_ESCAPE), difficulty-parameterized behavior (easy/normal/hard boost usage, prediction, flanking distance)
- Behavior: "Flanking herder" strategy—circles to center-side of player, charges to push them toward arena edge
- Difficulties: Easy (30% boost chance, conservative), Normal (50% boost), Hard (aggressive, faster reactions)
- Exports: `update(p1Pos, p2Pos, p1Vel, p2Vel, centerPos, arenaRadius, delta, state)`, `getInput()` returning control struct

**Online Multiplayer (WebSocket):**
- Purpose: Real-time networked 2-player gameplay via central server
- Location: `src/online.js` (client), `server/server.js` (server)
- Client Protocol: Custom JSON messages—`set_name`, `create_game`, `join_game`, `ready`, `start_game`, `player_input` (each frame), `game_state_update` (host broadcasts)
- Sync Strategy: Host runs physics and broadcasts tick; clients receive opponent state and apply locally
- Server: Node.js + WebSocket (ws library); manages game instances, player slots (host/client), stat tracking
- Used by: Triggered from online lobby UI; main loop sends/receives input and state when in ONLINE mode

## Data Flow

**Single-Frame Loop (60Hz desktop, 30Hz mobile):**

1. Input: `getPlayer1Input()`, `getPlayer2Input()` read keyboard+gamepad+touch
2. Physics: `updatePhysics(delta)` steps Rapier with fixed timestep accumulator
3. Entities: `player1.update()`, `player2.update()`, `arena.update()` consume input, apply forces, sync mesh to body
4. Collision: Manual circle-overlap check each frame; triggers knockback + effects (particles, lightning, shockwave)
5. Render: `updateRenderer()` composes scene via EffectComposer pipeline (render → bloom → output)

**Game State Lifecycle:**

MENU → GAME_MODE_SELECT → DIFFICULTY_SELECT → NAME_ENTRY → COUNTDOWN → PLAYING → ROUND_OVER → [loop or GAME_OVER]

**Online Multiplayer:**

Local input sent via `online.send()`; server relays opponent input; both clients drive physics independently with opponent state synced periodically to detect drift.



## Key Abstractions

**Game Store (`useGameStore`):**
- Purpose: Centralized state for game phases, scores, settings, online status
- Location: `src/store.js` — Zustand vanilla store accessed via `useGameStore.getState()`
- Persistence: Settings → localStorage; game mode/difficulty/player names → localStorage
- State fields: `gameState`, `gameMode`, `difficulty`, `p1Name`, `p2Name`, `p1Score`, `p2Score`, `settings`, `online`, `activeTileEffects`

**Power-Up System:**
- Purpose: Temporary physics/visual modifications to players
- Location: `src/entities/Player.js` line ~10—`POWER_UP_EFFECTS` array
- Pattern: Data-driven with `apply(player, duration)` and `remove(player)` methods
- Types: ACCELERATION_BOOST, SIZE_REDUCTION, WEIGHT_INCREASE, SPEED_BURST, LIGHT_TOUCH, etc.
- UI: Notifications display in top-right via `showPowerUpNotification()`

**Tile State Machine:**
- Purpose: Arena tiles with lifecycle (normal → ice/warning → falling → destroyed)
- Location: `src/entities/Arena.js`
- Transitions: Driven by timers (`destructionRate`, `iceRate` settings)
- Physics: When destroyed, Rapier collider removed from world

**Effect Systems (Particles, Lightning, Shockwaves):**
- Purpose: Visual feedback for collisions
- Particle System: GPU GLSL ShaderMaterial, emitted from collision epicenter
- Lightning System: Procedural bolts between two points
- Shockwave System: Expanding RingGeometry with radial gradient
- Optimization: Shared geometries reduce draw calls and GPU memory

**Hex Grid Utilities:**
- Purpose: Convert hex coordinates ↔ 3D positions for arena tiles
- Location: `src/utils/math.js` — `hexToPixel()`, `pixelToHex()`, `generateHexGrid()`, `hexDistance()`, `hexNeighbor()`
- Coordinate System: Axial cube coordinates (flat-top hexagons)

**Collision Detection:**
- Pattern: Per-frame circle-circle distance check; manual impulse application
- Trigger: distance(player1, player2) < sum(radii) → apply knockback
- Effects: Particle spray, lightning chain, shockwave expansion

## Entry Points

**Web/Desktop (Three.js Implementation):**
- Location: `src/main.js` → imported by `index.html`
- Initialization sequence: initPhysics() → initRenderer() → initInput() → initAudio() → setupButtonHandlers() → setupStoreSubscription() → animate()
- Game Loop: requestAnimationFrame calls animate() each frame
- Triggers: User interacts with UI (start button, mode select, etc.) → store state changes → DOM updates via store subscription

**Electron Desktop App:**
- Location: `electron/preload.js` → Node IPC bridge
- Build: Uses electron-builder (see `DESKTOP_BUILD.md`)
- Packaging: Creates standalone Mac/Windows executables with bundled game

**Server (Online Multiplayer):**
- Location: `server/server.js`
- Runtime: Node.js with ws library
- Responsibilities: HTTP static file serving, WebSocket connection handling, game instance management, player slot assignment, state broadcasting
- Scalability: Single-threaded; broadcasts game state to both players every ~16ms

**SDF/Ray-Marching (Experimental Entry Point):**
- Location: `src/sdf/main.js` → imported by `index-sdf.html` (parallel implementation)
- Uses shared store/input/audio from main codebase
- Renders via GLSL ray-marching shader instead of Three.js geometry

## Error Handling

**Strategy:** Defensive programming with null checks and optional chaining; errors logged to console.

**Patterns:**
- Entity cleanup: Use optional chaining `player1?.cleanup()`, `arena?.cleanup()` to avoid crashes if entity undefined
- Physics queries: Check `if (world)` before stepping; default world to null if init fails
- Input fallback: If gamepad disconnects, falls back to keyboard immediately; no gameplay interruption
- Online recovery: WebSocket reconnect logic with exponential backoff (max 5 attempts), message queue buffers outgoing messages until connected
- Settings merge: Defaults always merged with user localStorage; missing settings filled in automatically

**No explicit error boundaries:** Unhandled errors propagate to browser console; game doesn't pause

## Cross-Cutting Concerns

**Performance Instrumentation:**
- Code pattern: Comments flag optimization hotspots with "PERFORMANCE: [note]"
- Examples: Shared tile geometry (reduces GPU memory), mobile constraints reduced, bloom skip on low-power devices, physics accumulator cap prevents spiral-of-death
- Mobile auto-scaling: Renderer, physics, input all detect and adapt to device capability

**State Persistence:**
- What persists: Player names, difficulty, game mode, all settings (theme, sphere size, volumes, boost speed)
- Where: localStorage under keys like `dropfall_settings`, `dropfall_p1name`, `dropfall_difficulty`
- When: Settings persisted immediately on change; names saved when set

**Theming System:**
- Location: `src/utils/themeTextures.js`
- Pattern: Factory functions return theme-specific MeshStandardMaterial params (colors, roughness, metalness, texture maps)
- Themes: `default` (neon cyberpunk), `beach` (tropical), `cracked_stone` (marble)
- Scope: All surfaces (tiles, player, lights) respect theme setting

**Audio Synthesis:**
- Approach: Web Audio API with programmatic synthesis; no audio file assets
- Music: EDM-style adaptive BPM (135 base, scales with gameplay intensity)
- SFX: Collision sounds (pitched by intensity), boost sounds, destruction sounds
- Dynamic: Music speed scales with game pace (setMusicSpeed multiplier applied)

**Logging:**
- Pattern: Raw `console.log()` / `console.error()` throughout; no dedicated logger
- Conventions: Online layer uses `[Online]` prefix, store layer uses `[Store Sub]` prefix, AI uses `[AI]` prefix
- Debug traces: Game state transitions logged, WebSocket events logged, entity lifecycle events logged

**Input Normalization:**
- All input sources normalize to common `{forward, backward, left, right, boost}` struct
- Keyboard mapping: P1={W,A,S,D,ShiftLeft}, P2={ArrowUp,ArrowLeft,ArrowDown,ArrowRight,ShiftRight}, customizable in settings
- Gamepad mapping: Analogue sticks for movement, buttons for boost
- Touch: Screen division into up/down/left/right zones + center for boost

---

*Architecture analysis: 2026-03-28*
