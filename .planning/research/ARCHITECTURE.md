# Research: Architecture Integration for Racing Mode

**Scope:** How racing mode fits into Dropfall's existing Three.js + Rapier3D + Zustand architecture without breaking Classic mode.

## Existing Architecture Baseline (Verified v2.1)

**Current Flow:**
- Game Loop (`src/main.js`): Polls input → updates physics → updates entities → renders
- State Machine: MENU → GAME_MODE_SELECT → {DIFFICULTY_SELECT, NAME_ENTRY} → COUNTDOWN → PLAYING → ROUND_OVER
- Entities: Player (physics body + mesh), Arena (tiles + physics bodies), Effects (particles, lightning, shockwave)
- Store (`src/store.js`): Centralized state; subscriptions allow reactive updates

**Current Game Modes:**
1. Local 2-player
2. Single-player with AI opponent
3. Online multiplayer (WebSocket)

**Rendering Path:** Three.js scene → EffectComposer pipeline (bloom, tone mapping) → canvas

## Racing Mode Integration Points

### 1. Game Mode Selection (Store + UI)
**Current State:** Game mode selected at GAME_MODE_SELECT phase
**Change Required:** Add "Race" option alongside "Classic"

```javascript
// src/store.js (add to gameState)
gameMode: 'CLASSIC' | 'RACE',  // Existing uses 'LOCAL_2P', 'SINGLE_PLAYER', 'ONLINE'
```

**Impact:** Minimal — just another branch in game flow
**Timing:** Existing, no new phase needed

### 2. Arena Variant System
**Current:** `Arena` class generates hex tile grid with STATE_MAP (NORMAL, ICE, PORTAL, BONUS, FALLING, WARNING)

**Racing Alternative:**
```
RaceTrack extends Arena (or create variant)
- Tile types: NORMAL, BOOST_ZONE, WALL, CHECKPOINT, FINISH
- Layout: Pre-designed path (not random hex grid)
- No falling mechanics
- Static (tiles don't fall)
```

**Integration Strategy:**
- Create `RaceTrack` class in `src/entities/RaceTrack.ts`
- Reuse tile geometry and rendering
- Override `update()` to remove falling logic
- Override `createTrackLayout()` to place tiles in racing paths

**Physics Changes:**
- Boost zone: Tile with trigger volume that applies impulse to player
- Wall: Solid collider, bounces player (existing collision already works)
- Checkpoint: Lightweight trigger volume (raycast or overlap check)

**Impact:** Low — tile rendering, physics already support this

### 3. Player State & Tracking
**Current:** Player tracks health, position, velocity, power-ups
**Racing Changes:**
- Add: `currentLap`, `lapStartTime`, `bestLapTime`, `checkpointsHit`
- Add: Speed display state (for HUD)
- Remove: Health/death system (racing mode = no death)

**Integration:**
```javascript
// src/entities/Player.js (add racing properties)
if (gameMode === 'RACE') {
  this.currentLap = 0;
  this.lapStartTime = 0;
  this.bestLapTime = Infinity;
  this.checkpointsHit = [];
}
```

**Impact:** Minimal — conditional state, no architectural change

### 4. Game Loop Branching
**Current Loop (src/main.js):**
```
each frame {
  input ← getPlayer1Input(), getPlayer2Input()
  physics ← world.step()
  update ← player1.update(input), arena.update()
  render ← renderer()
}
```

**Racing Variant:**
```
if (gameMode === 'CLASSIC') {
  classicUpdate()  // Existing logic
} else if (gameMode === 'RACE') {
  raceUpdate()     // New logic
}
```

**Race-Specific Logic:**
- Checkpoint tracking (did player cross checkpoint this frame?)
- Lap counting (crossed finish line = new lap)
- Speed calculation (for HUD, speed-based effects)
- Finish detection (player completed N laps?)
- No destruction/falling logic

**Impact:** Moderate — adds conditional branching (best isolated in separate function)

### 5. HUD / UI Layer
**Current HUD:**
- Player names, scores, health bars, power-ups, round timer

**Racing HUD:**
- Speed (km/h or units/s)
- Lap time (current, best, delta)
- Lap number (e.g., "Lap 2/3")
- Finish status (if complete)

**Integration:**
- Extend existing HUD drawing code with race-specific branches
- Reuse canvas rendering, just different draw calls
- Speed calculation from player velocity: `sqrt(vx² + vz²)`

**Impact:** Low — UI branch, no physics/state changes

### 6. Physics Tuning Per Mode
**Current Physics Defaults:**
```javascript
gravity: -20.0
sphereRestitution: 1.5
sphereFriction: 0.5
sphereWeight: 100.0
```

**Racing Tuning:**
- Lower friction (0.3-0.4) for sliding feel
- Keep restitution high for bouncy reaction
- Higher gravity possible (but test with -20.0 first)
- Ball mass same (100.0)

**Implementation:**
```javascript
const physicsProps = gameMode === 'RACE' 
  ? { friction: 0.3, gravity: -20.0 }
  : { friction: 0.5, gravity: -20.0 };
// Apply to player creation
```

**Impact:** Low — module exports already parameterized

### 7. Audio Integration
**Current:** Track-based music, collision sounds, boost sounds

**Racing Additions:**
- Engine/speed loop sound (pitched by speed)
- Lap complete chime
- Finish celebration sound
- Boost activation tone (reuse existing)

**Integration:**
- Extend `src/audio.js` with mode-specific tracks
- Pitch speed sound based on velocity magnitude
- Trigger lap/finish events from race logic

**Impact:** Low — audio system already modular

### 8. Data Flow (New vs Existing)

```
┌─────────────────────────────────────────────────┐
│ MENU → MODE_SELECT → {CLASSIC | RACE}          │
└─────────────┬───────────────────────────────────┘
              │
      ┌───────┴──────────┐
      │                  │
    CLASSIC            RACE
      │                  │
      └──────────────────┤
            (shared physics, rendering)
            │
      ┌─────┴─────────────────────┐
      │                           │
  GAME_RUNNING (shared)      RACE_SPECIFIC:
      │                       - Checkpoints
      │                       - Lap tracking
      │                       - Speed HUD
      │                       - Finish detect
      │
      └─────────────────────────────┘
          ROUND_OVER / FINISH
```

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Breaking classic mode | Low | Use conditional branches, test both modes |
| Performance regression | Low | Racing has fewer effects than classic |
| Input lag with new speed logic | Low | Speed calc is simple (one frame latency max) |
| Physics tuning asymmetry | Medium | Test both modes thoroughly, document tweaks |
| Checkpoint detection false positives | Medium | Use generous collision volumes, edge case test |

## Recommended Architecture

1. **Create `RaceTrack` class** (or `RaceArena`)
   - Inherits tile rendering from Arena
   - Overrides layout generation for pre-designed tracks
   - No falling or destruction logic

2. **Add `RaceMode` system** (or extend `GameMode`)
   - Encapsulates race-specific update logic
   - Tracks checkpoints, laps, speed
   - Emits events (lap complete, finish)

3. **Branch game loop** (minimal condition in main.js)
   - If race mode, call `updateRaceMode()`
   - Otherwise, call classic `updateGame()`

4. **HUD system** (reuse existing UI, add race branch)
   - Conditional draw calls based on mode
   - No new rendering pipeline

5. **Physics presets** (configuration per mode)
   - Define racing friction/gravity as named preset
   - Apply on mode selection

## Implementation Order

**Phase 1 (Core Racing):**
1. Add game mode selection
2. Create RaceTrack class (tile layout only)
3. Add checkpoint/lap tracking
4. Implement finish detection
5. Add basic speed HUD

**Phase 2 (Polish):**
6. Add boost zones (physics trigger)
7. Particle/effect feedback for speed
8. Sound integration
9. UI refinement

**Phase 3 (Content):**
10. Multiple track designs
11. Difficulty variations

## Conclusion

Racing mode **fits cleanly** into existing architecture via:
- **Conditional branching** (not invasive)
- **Reused systems** (physics, rendering, input)
- **Mode-specific variants** (RaceTrack arena, race update logic)
- **Store extension** (new state properties)

**No architectural refactoring required.** Integration is additive, not invasive.

**Estimated changes:**
- New files: `RaceTrack.ts`, `RaceMode.ts` (or combined)
- Modified files: `main.js` (game loop branch), `store.js` (mode state), `Arena.ts` (maybe inheritance), `Player.ts` (add race properties)
- Lines of new code: ~500-800
