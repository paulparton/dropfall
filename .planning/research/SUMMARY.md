# Research Summary: Racing Mode for Dropfall

**Milestone:** v2.2 Single-Player Race Mode
**Research Date:** 2026-04-01
**Synthesis:** Feasibility, design patterns, integration strategy

---

## Key Findings

### 1. Stack Status: ✅ READY (No New Dependencies)

Existing tech stack fully supports racing mechanics:
- **Three.js + Rapier3D combo** ideal for arcade racing physics
- **Zustand store** easily extends for race state (lap time, speed, checkpoints)
- **Existing particle/effects system** perfectly suited for speed feedback
- **Theme system** adapts to racing aesthetic (fast colors, glow)

**Stack Conclusion:** NO additions needed. Racing is content + integration work, not tech work.

### 2. Feature Framework: Table Stakes vs Differentiators

**Table Stakes (Must Have for v2.2):**
- Speed-sensation feedback (HUD + visual effects)
- Track navigation with curves and strategy
- Lap/checkpoint detection with clear completion condition
- Responsive controls (immediate acceleration, smooth steering)

**Mario Kart Differentiators:**
- Boost zones that reward skill
- Dynamic visual feedback (particles, color, sound)
- Multiple track difficulties (easy → hard progression)
- Precise speed feedback in HUD

**Scope Decision:** All table stakes + differentiators achievable in v2.2; multiplayer racing deferred to v2.3+

### 3. Architecture: Clean Conditional Integration

Racing fits into Dropfall architecture via:
- **Minimal branching:** Conditional game loop (classicUpdate vs raceUpdate)
- **Mod variants:** RaceTrack class (inherits tileing, overrides layout)
- **Mode-specific state:** Store extended with `currentLap, bestLapTime, checkpoints`
- **Physics presets:** Config-driven friction/gravity tuning per mode
- **HUD branches:** Conditional UI draw logic (no architectural change)

**Integration Risk:** LOW — all points are additive, no existing system refactoring needed
**Estimated Code:** 500-800 lines new code, ~5 modified files

### 4. Primary Pitfalls & Prevention

**Top 5 Risks:**
1. **Mode state bleeding** (classic state affects race) → Isolate mode state, add cleanup
2. **Checkpoint ghost triggers** (lap counts by 3+) → Track checkpoint ID, cooldown
3. **Physics tuning breaks feel** (too slippery, unresponsive) → Iterate friction, playtest
4. **Track design unfair** (impossible corners, bad layout) → Design with sightlines, external playtest
5. **Performance drops on mobile** (too many tiles/particles) → Profile, optimize tile count/particles

**Prevention Approach:** Strong UAT in Phase 3 with gameplay testing + mobile device testing

### 5. Design Pattern: Speed Feedback is the Core

Mario Kart magic comes from:
- **Constant visual confirmation** that you're going fast (HUD, particles, blur)
- **High-polish feedback** on every action (boost, collision, lap)
- **Track design guiding flow** (sightlines, turns that feel good)
- **Physics that feel snappy** (responsive steering, momentum feels earned)

Racing is not about complex mechanics—it's about **feeling**.

---

## Recommendations

### For Phase Planning:

**Phase 1 (Game Mode Fundamentals):** 3-4 days
- Game mode selection in UI
- RaceTrack class creation (static layout, no falling)
- Checkpoint + lap tracking system
- Finish detection
- Basic HUD (speed, lap count, time)

**Phase 2 (Physics & Gameplay):** 3-4 days
- Physics tuning (friction, boost strength)
- Boost zone implementation (tiles that accelerate)
- Wall/obstacle tiles
- Speed-based visual feedback (particles, audio pitch)
- Playtest + iterate on feel

**Phase 3 (Polish & Validation):** 3-4 days
- Multiple track designs (2-3 difficulty levels)
- Mobile testing + optimization
- UAT (comprehensive) with external playtest
- Performance profiling
- Final polish (HUD refinement, visual effects)

### For Architecture:

1. **Create branching game mode system** (not hardcoded conditionals)
   - Prepare for future game modes (survival, puzzle, etc.)
   - Cleaner main loop

2. **Separate concerns: Track generation from tile rendering**
   - Makes track variations easier
   - Enables procedural generation in future

3. **Physics presets as named configs** (not magic numbers)
   - Easy to adjust feel
   - Can A/B test efficiently

### For Content:

1. **Design 3 track difficulties**
   - Easy: Straightforward path, few turns, forgiving width
   - Medium: Strategic turns, some obstacles, boost challenge
   - Hard: Precise geometry, tight sections, true racing skill required

2. **Each track should have theme alignment**
   - Arctic track: icy aesthetic, slippery but pretty
   - Inferno track: hot colors, boost-heavy design
   - Temple track: ancient hazards, precision required

---

## Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Physics tuning overshoots (unplayable) | Medium | High | Allocate extra Phase 2 time, get playtest early |
| Mobile performance issues | Medium | Medium | Profile early, optimize tile count |
| Checkpoint system bugs | Low | High | Strong unit tests, careful state management |
| Mode state corruption | Low | High | Comprehensive clear/reset on mode change |
| Track design feels bad | Medium | Medium | External playtest, iterate quickly |

**Overall Risk Level:** MODERATE-LOW — All risks are mitigatable with engineering discipline + playtesting.

---

## Success Criteria (for Research Validation)

- [x] Stack identified: all tech needed exists
- [x] Feature scope clear: table stakes + Mario Kart patterns defined
- [x] Architecture mapped: integration points identified, no refactoring needed
- [x] Pitfalls catalogued: prevention strategies documented
- [x] Implementation feasible: 3-phase approach realistic for scope

**Research Verdict:** ✅ PROCEED — Feasibly and well-understood.

---

## Context for Next Steps

### For Requirements Definition:
- Racing = single-player leaderboard mode initially
- Focus: Speed, precision, progression through difficulty
- Reuse: All existing physics, rendering, input systems
- Constraint: No multiplayer racing in v2.2 (simplify scope)

### For Roadmap:
- Phase 1: Core racing (mode selection, lap tracking, basic HUD)
- Phase 2: Gameplay feel (physics tuning, boost zones, visual feedback)
- Phase 3: Content + validation (tracks, mobile, UAT)

### For Architecture Prep:
- Strategy decided: Conditional branching, not major refactor
- Estimated LOC: 500-800 new, ~5 files modified
- Performance impact: LOW (fewer effects than classic)

---

## Deliverables Ready for Requirements?

✅ **Sufficient context:** Requirements team has everything needed
✅ **Scoped feasibility:** v2.2 scope is realistic
✅ **Technical confidence:** Implementation path clear
✅ **Risk understood:** Major pitfalls identified and preventable
✅ **Success metrics:** Clear definition of what "good racing" means

**Proceed to: REQUIREMENTS.md creation**
