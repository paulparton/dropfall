# Research: Pitfalls & Prevention for Racing Mode Implementation

**Focus:** Common mistakes when adding racing modes to existing game systems, specific to Dropfall's architecture.

## Pitfalls by Category

### 1. Game State & Mode Management Pitfalls

**Pitfall A: Mode State Bleeding**
- **Problem:** Classic mode state affects racing mode (or vice versa)
  - Example: Player health from classic carries over
  - Example: Destruction tiles appear in race
  - Example: AI opponent spawns in race mode

- **Prevention:**
  - ✅ Isolate mode-specific state in store
  - ✅ Clear player health/status on mode transition
  - ✅ Conditionally create Arena vs RaceTrack based on mode
  - ✅ Test: Switch from classic → race → classic; verify no corruption

- **When to Detect:** During integration testing (phase 3)

**Pitfall B: Incomplete State Reset**
- **Problem:** Racing mode state persists after returning to menu
  - Example: Lap count shows "3" on next race attempt
  - Example: Timer doesn't reset, shows garbage time

- **Prevention:**
  - ✅ Add mode-specific cleanup in store.endRound()
  - ✅ Zero out race state: `currentLap = 0, bestLapTime = Infinity`
  - ✅ Test: Play race → go to menu → start new race; verify clean state

- **When to Detect:** Phase 3 UI testing

### 2. Physics & Collision Pitfalls

**Pitfall C: Checkpoint Ghost Contacts**
- **Problem:** Checkpoint trigger fires multiple times in one crossing
  - Root cause: Rapier's per-frame contact callback fires every frame player overlaps trigger
  - Symptom: Lap count increments by 3-5 on single crossing

- **Prevention:**
  - ✅ Track checkpoint ID + frame-last-hit in player state
  - ✅ Only count if `lastCheckpointHit !== currentCheckpointId || frameGap > 2`
  - ✅ Alternative: Use timer-based cooldown (can't trigger same checkpoint for 0.5s)
  - ✅ Test: Cross checkpoint at various speeds, verify lap count = 1 not 3

- **When to Detect:** Phase 2 physics tuning

**Pitfall D: Momentum Carryover Issues**
- **Problem:** Player velocity from classic mode destroyed race feel
  - Root cause: Classic mode has destruction-induced bounces, race should have clean momentum
  - Symptom: Ball feels "boosted" at start of race, uncontrollable

- **Prevention:**
  - ✅ On entering race mode, zero player velocity: `player.rigidBody.setLinvel({x: 0, y: 0, z: 0})`
  - ✅ Test: Exit classic mid-game with high speed → enter race; verify starting from rest

- **When to Detect:** Phase 1 mode switching

**Pitfall E: Friction Mismatch Breaks Control**
- **Problem:** Lowered friction for racing (0.3 vs 0.5) causes:
  - Player overshoots turns (can't grip track)
  - Steering feels slippery, unresponsive
  - Players hate it

- **Prevention:**
  - ✅ Tune friction iteratively: test 0.3, 0.4, 0.5
  - ✅ Pair friction with boost strength tuning (lower friction → lower boost accel)
  - ✅ Test: Drive around track, verify responsive steering without sliding off
  - ✅ Consideration: Mobile may need higher friction (less precise input)

- **When to Detect:** Phase 2 gameplay feel testing

**Pitfall F: Boost Zone Physics Edge Cases**
- **Problem:** Boost trigger applies impulse, but:
  - Airborne player doesn't get boost (already in air)
  - Fast player overshoots boost zone, barely hits it
  - Slow player gets stuck oscillating in boost zone

- **Prevention:**
  - ✅ Apply boost as direct velocity set, not impulse: `setLinvel({...boosted_vel})`
  - ✅ Boost should apply once per pass (use cooldown like checkpoint)
  - ✅ Test: Cross boost zone at various speeds and angles; verify consistent behavior
  - ✅ Airborne test: Jump-boost; verify momentum addition works

- **When to Detect:** Phase 2 boost zone tuning

### 3. Track Design Pitfalls

**Pitfall G: Unfair Track Layout**
- **Problem:** Track design accidentally makes racing frustrating
  - Example: Narrow section followed by blind turn (unnavigable at speed)
  - Example: Boost zone right before tight turn (uncontrollable)
  - Example: Wall placement creates invisible collision pocket

- **Prevention:**
  - ✅ Design tracks with "sightlines" — player sees next turn before committing
  - ✅ Place boost zones on straightaways, not before technical sections
  - ✅ Test: Run track at different speeds (slow, medium, fast); verify all are playable
  - ✅ Checkpoint placement: Ensure clear path from checkpoint to checkpoint
  - ✅ Get external playtest feedback (ask a team member to race)

- **When to Detect:** Phase 2 track design + Phase 3 UAT

**Pitfall H: Tile Stacking Causes Physics Clipping**
- **Problem:** Elevating track by stacking tiles creates:
  - Gaps where player falls through (tile edge misalignment)
  - Ledges that catch player unexpectedly
  - Z-fighting in rendering (two tiles at same height)

- **Prevention:**
  - ✅ Test hexagon tile vertical stacking; document safe Y-offsets
  - ✅ Use consistent elevation gains (e.g., every +2.0 units per height level)
  - ✅ Render track in debug mode with physics colliders visible
  - ✅ Test: Drive up and down elevation; verify smooth transitions

- **When to Detect:** Phase 1 RaceTrack creation

**Pitfall I: Checkpoints Placed at Impossible Angle**
- **Problem:** Checkpoint perpendicular to track flow
  - Player can trigger from wrong side (backslide into checkpoint)
  - Lap counting becomes nonsensical

- **Prevention:**
  - ✅ Checkpoint orientation should align with track direction
  - ✅ Require player velocity > 0 in forward direction to trigger (dot product check)
  - ✅ Visual indicator: Place waypoint indicator on track before checkpoint
  - ✅ Test: Race backwards around track; verify checkpoints don't trigger

- **When to Detect:** Phase 2 checkpoint system

### 4. Rendering & Visual Pitfalls

**Pitfall J: Bloom/Glow Too Aggressive in Racing**
- **Problem:** Existing bloom settings from classic mode:
  - Make track hard to see at speed (too much glow)
  - HUD speed indicator washed out (bloom blooms the text)
  - Visual feedback muddy, hard to distinguish elements

- **Prevention:**
  - ✅ Test existing bloom with racing visuals
  - ✅ If needed, create race-specific bloom preset (lower threshold/strength)
  - ✅ Exclude HUD text and numbers from bloom layer
  - ✅ Test: Race at high speed, verify track is clear and HUD readable

- **When to Detect:** Phase 2/3 visual polish

**Pitfall K: Speed Particles Obscure Track**
- **Problem:** Adding speed-based particle effects:
  - Too many particles = frame rate drop (especially mobile)
  - Particles obscure vision of track/obstacles ahead
  - Visual noise confusing instead of helpful

- **Prevention:**
  - ✅ Cap particle count: max 200-300 speed particles (not unlimited)
  - ✅ Particle layer: below or beside player, not in front of view
  - ✅ Trail effect: subtle streaks, not explosions
  - ✅ Test on mobile: Verify 60fps maintained during heavy particle scenes
  - ✅ A/B test: with/without particles; verify improved feel, not degraded

- **When to Detect:** Phase 2 particle effects tuning

### 5. Input & Controls Pitfalls

**Pitfall L: Steering Lag in Racing Context**
- **Problem:** Game loop reads input, then applies forces, input delay feels worse in racing than classic
  - Classic: Slight input lag barely noticed (physics-engine driven)
  - Racing: Slight input lag feels like "car handles like a truck"

- **Prevention:**
  - ✅ Ensure input polling at frame start (not after rendering)
  - ✅ Apply movement forces immediately in same frame (no 1-frame delay)
  - ✅ Test: Compare classic vs race steering responsiveness
  - ✅ Measure input-to-visual latency (controller press → ball moves) < 50ms

- **When to Detect:** Phase 2 gameplay feel testing

**Pitfall M: Touch Controls Incompatible with Racing**
- **Problem:** Existing touch tap-regions work for classic, not for racing
  - Tap-based boost and directional pads = not continuous input
  - Racing requires smooth steering (analog-like)

- **Prevention:**
  - ✅ Racing mode requires continuous drag input (not tap)
  - ✅ Consider disabling racing mode on touch (mobile-only classic)
  - ✅ Or implement racing touch: drag on screen to steer (left-right)
  - ✅ Test: Play racing on mobile; verify controls feel natural

- **When to Detect:** Phase 2 mobile testing

### 6. Mode Interaction Pitfalls

**Pitfall N: Online/Multiplayer Racing Not Designed**
- **Problem:** If trying to add multiplayer racing without design:
  - Checkpoint detection conflicts with two players
  - Whose lap time counts?
  - Tie-breaking logic undefined

- **Prevention:**
  - ✅ For v2.2: Single-player ONLY, no online/multiplayer
  - ✅ Document this as out-of-scope
  - ✅ Design multiplayer racing in future phase
  - ✅ Test: Verify racing unavailable in multiplayer mode select

- **When to Detect:** Phase 1 mode selection

**Pitfall O: Game Over Condition Ambiguous**
- **Problem:** Classic has clear game over (death), racing needs condition:
  - Complete N laps? But player can race infinitely
  - Time limit? But not communicated to player
  - Best time challenge? Not implemented

- **Prevention:**
  - ✅ Define finish condition clearly: "Complete 3 laps" or "Race for 60 seconds"
  - ✅ Communicate in pre-race UI before starting
  - ✅ Test: Start race, read instructions, understand goal
  - ✅ Goal achieved = show finish screen with time/laps

- **When to Detect:** Phase 1 requirements gathering

### 7. Performance Pitfalls

**Pitfall P: Track Too Complex, Frame Rate Drops**
- **Problem:** Adding many tiles for track = many physics bodies + render calls
  - Desktop: OK
  - Mobile: 15fps, unplayable

- **Prevention:**
  - ✅ Profile track rendering + physics cost
  - ✅ Design tracks with 50-150 tiles, not 1000+
  - ✅ Reuse tile geometry/materials (already done in Arena)
  - ✅ Test on mobile: Verify 30fps minimum during racing

- **When to Detect:** Phase 1 track design

**Pitfall Q: Lap Timer Updates Every Frame, GC Pressure**
- **Problem:** Creating new time strings/UI elements every frame:
  - Creates heap garbage
  - GC pauses cause frame jank
  - Mobile especially vulnerable

- **Prevention:**
  - ✅ Update lap time in store, not UI every frame
  - ✅ Render cached time strings, update only if changed
  - ✅ Use number formatting once, cache result
  - ✅ Test: Monitor frame timing; no spikes during timer updates

- **When to Detect:** Phase 3 polish, before shipping

## Prevention Strategy

### By Phase:

**Phase 1 (Fundamentals):**
- ✅ Isolate race state (no bleeding from classic)
- ✅ Test mode switching (enter/exit racing cleanly)
- ✅ Verify physics reset on mode enter
- ✅ Design track layout (avoid pitfall G)

**Phase 2 (Gameplay):**
- ✅ Implement checkpoint/lap system (prevent pitfall C)
- ✅ Tune physics friction (prevent pitfall E)
- ✅ Test boost zones (prevent pitfall F)
- ✅ Test steering responsiveness (prevent pitfall L)
- ✅ Playtest on desktop (general feel)

**Phase 3 (Polish & Finish):**
- ✅ Refine visual feedback (prevent pitfall K, J)
- ✅ Test mobile performance (prevent pitfall P)
- ✅ Optimize UI updates (prevent pitfall Q)
- ✅ External playtest feedback (prevent pitfall G)

## Testing Checklist

Before shipping phase:
- [ ] Classic mode unaffected by race code
- [ ] Race mode starts clean (no leftover state)
- [ ] Checkpoint crossing doesn't double-count
- [ ] Boost zones apply consistently
- [ ] Steering is responsive, feels good at speed
- [ ] Track doesn't have collision dead-zones
- [ ] Mobile maintains 30fps
- [ ] HUD readable during gameplay
- [ ] Finish condition clear and achievable

## Conclusion

**Primary Pitfall Category:** Mode-state management and physics tuning.

**Easy Wins:** Comprehensive testing, mode isolation, physics presets.

**Hard Part:** Racing "feel" (friction, boost balance, track geometry) — requires iteration and playtesting.

**Schedule Impact:** Pitfall prevention requires extra testing phase (Phase 3 extended), but prevents post-launch fixes.
