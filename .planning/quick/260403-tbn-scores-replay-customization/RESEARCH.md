# Quick Task 260403-tbn: Research Findings

**Completed:** 2026-04-03  
**Focus:** Implementation approaches for scores, replay system, and character customization

## Codebase Architecture Summary

### State Management (Zustand Store)
- **Location:** `src/store.ts`
- **Current State:** Already contains `p1Score`, `p2Score`, `p1Hat`, `p2Hat` fields
- **Pattern:** Zustand with persist middleware for persistent state
- **Implication:** Score tracking infrastructure exists; just needs UI display
- **API:** `useGameStore.getState()` for sync access, store subscription for updates

### Rendering Pipeline
- **Canvas Rendering:** Main Three.js scene in `src/renderer.js` with post-processing (bloom, tone mapping)
- **DOM Integration:** Canvas appended to `#app` div; can overlay HTML elements
- **Font Rendering:** Currently used for countdown/game state; no dedicated text system yet
- **Advantage:** Can add HTML overlay for scores, customization UI without modifying 3D renderer

### Ball Rendering System
- **Location:** `src/entities/Player.js` creates ball mesh with Three.js
- **Texture:** Canvas-based texture with `createBallWithHatCanvas()` in `src/main.js`
- **Hat Support:** Already implemented (santa, cowboy, afro, crown, dunce, none)
- **Color Palette:** 10 colors pre-defined (red, green, blue, yellow, magenta, cyan, orange, pink, lime, light blue)
- **Material:** Uses canvas texture mapped to sphere geometry
- **Implication:** Can extend color palette and add customization UI without modifying 3D rendering code

### Game Loop & Physics
- **Location:** `src/main.js` (120+ lines per frame loop)
- **Frame Data Available:** Player positions, velocities, boost, round state, winner
- **Physics World:** Cannon.js with entity synchronization each frame
- **Implication:** Can record frame state during game loop by capturing entities' position/velocity snapshots

### Input System
- **Location:** `src/input.js` and `src/handlers/InputHandler.ts`  
- **Pattern:** Keyboard mappings (WASD for P1, arrows for P2), gamepad support
- **Store Integration:** Settings store contains `controls.p1` and `controls.p2` key mappings
- **Implication:** Customization UI needs to hook into game mode selection before match starts

### Existing UI Patterns
- **Game States:** MENU → GAME_MODE_SELECT → DIFFICULTY_SELECT → NAME_ENTRY → COUNTDOWN → PLAYING → ROUND_OVER → GAME_OVER
- **Location:** Store has `gameState` field tracking current phase
- **Name Entry:** Already exists for player names (`p1Name`, `p2Name`)
- **Implication:** Can extend existing flow to add customization step AFTER name entry

---

## Implementation Approach

### 1. Scores Display
**What to build:** Overlay text during PLAYING/ROUND_OVER states showing wins

**How to integrate:**
- Create `ScoresOverlay.tsx` component (or `.js` if staying in JavaScript)
- Subscribe to store: `p1Score`, `p2Score`, `p1Name`, `p2Name`
- Render as HTML div overlay on top of canvas (z-index: 10)
- Position: Top-right corner, font matching game scale (18-24px)
- Update on store change

**Files affected:** 
- Create: `src/components/ScoresOverlay.ts` (new)
- Modify: `src/main.js` (import and render overlay in game loop)

**Complexity:** Low (data already in store, just needs UI)

### 2. Replay System
**What to build:** Frame buffer recording + playback UI

**How to integrate:**
- Create `ReplayRecorder.ts` class in `src/systems/`
  - Circular buffer storing frame state: `{ position: {x, y, z}, velocity, rotation, boost, health }`
  - Size limit: ~5MB or max 1000 frames
  - Record every frame during PLAYING state (trivial overhead: ~5KB per frame for two entities)
- Create `ReplayPlayer.ts` for playback
  - Takes frame buffer, replays at variable speed
  - Integrates with THREE.js renderer
- Add replay UI modal after ROUND_OVER state
  - "Watch Replay" button shows 3-second clip of falling
  - "Show All" button shows full match

**Files affected:**
- Create: `src/systems/ReplayRecorder.ts` (new)
- Create: `src/systems/ReplayPlayer.ts` (new)
- Modify: `src/main.js` (start/stop recording based on game state)
- Modify: `src/store.ts` (add replay buffer to state or external manager)

**Complexity:** Medium (needs frame state tracking and replay playback logic)

### 3. Character Customization UI
**What to build:** Modal/screen for color and hat selection with live preview

**How to integrate:**
- Create `CustomizationModal.tsx` component
  - Shows 12 color swatches (extend from existing 10)
  - Shows 4-5 hat options (use existing hat types)
  - Live preview: mini 3D scene with selected ball/hat rendered in real-time
  - Confirm button updates store
- Add to game flow: AFTER name entry, BEFORE countdown
  - Update state machine: `NAME_ENTRY → CUSTOMIZATION → COUNTDOWN`
- Single-player: Show customization for both player AND AI

**Files affected:**
- Create: `src/components/CustomizationModal.ts` (new)
- Create: `src/components/ColorPalette.ts` (new color definitions)
- Modify: `src/store.ts` (add `p1Color`, `p2Color` fields if not already there)
- Modify: `src/main.js` (game state machine, plug customization step)
- Modify: `src/entities/Player.js` (read color from store instead of generating random)

**Complexity:** Medium (new component tree, needs 3D preview, but reuses existing ball rendering)

---

## Risk & Constraints

### Browser Memory
- Replay buffer: ~5KB per frame × 1000 frames = 5MB (acceptable)
- Multiple games: Auto-trim older replays to prevent > 50MB total memory

### Cross-platform
- HTML overlay scores work on desktop/mobile
- Customization modal: Works on mobile (modal-friendly)
- 3D preview: May need to disable on low-end mobile (fallback to 2D swatch preview)

### Online Multiplayer
- Scores: Already synced via `opponentName` in OnlineState; just display locally
- Replay: Record bidirectional (both players' moves); sync metadata only
- Customization: Exchange color/hat in handshake; store in OnlineState

---

## Recommended Implementation Order

1. **Scores Display** (simplest, 1-2 hours)
   - Add `p1Color`, `p2Color` to store if missing
   - Create ScoresOverlay.ts
   - Render during PLAYING state

2. **Replay System** (medium, 3-4 hours)
   - Build ReplayRecorder.ts with circular buffer
   - Build ReplayPlayer.ts with playback logic
   - Test with simple frame dumping first

3. **Customization UI** (medium-complex, 4-5 hours)
   - Extend color palette to 12 colors
   - Create CustomizationModal.ts with swatch selection
   - Add 3D live preview using existing ball rendering
   - Integrate into game state machine (add CUSTOMIZATION state)

**Total Estimated Effort:** 8-11 hours

---

## Key Assumptions Locked

✅ Scores persist per session (not across page refreshes)  
✅ Replay buffer stored in-memory (export/download as future work)  
✅ Color palette = 12 predefined colors (not custom picker)  
✅ Hat options = subset of existing hat types  
✅ Live preview rendered via Three.js (not canvas fallback)  
✅ Customization step integrated AFTER name entry in game state machine
