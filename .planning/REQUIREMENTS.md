---
version: 2.2
milestone: v2.2 Single-Player Race Mode
created: 2026-04-01
status: active
---

# Dropfall v2.2 Requirements: Single-Player Race Mode

**Milestone Goal:** Introduce a second game mode offering racing gameplay with Mario Kart-style track design using existing ball physics and tile mechanics.

---

## Requirements by Category

### GAME_MODE: Game Mode Selection and State Management

User can select between Classic and Race modes before starting a game.

- [ ] **GM-01**: User can select "Race Mode" from main game mode selection menu
- [ ] **GM-02**: System initializes Race state when entering race mode (zeroed lap count, timers, checkpoints)
- [ ] **GM-03**: Classic mode unaffected when switching to/from Race mode (no state corruption)
- [ ] **GM-04**: Game returns to mode selection after race completes or user exits

### TRACK: Track Design and Navigation

User navigates a pre-designed race track with clear path, obstacles, and strategic elements.

- [ ] **TR-01**: Race track rendered with hexagonal tiles forming a navigable path
- [ ] **TR-02**: Track includes straightaways and turns (minimum 3 turns)
- [ ] **TR-03**: Track includes elevation changes via tile stacking or height variation
- [ ] **TR-04**: Walls/obstacle tiles that player bounces off (non-traversable sections)
- [ ] **TR-05**: Track layout supports Mario Kart-style flow (sightlines visible before turns)
- [ ] **TR-06**: One initial track design available for v2.2 (default difficulty)

### PHYSICS: Ball Physics Adapted for Racing

Ball movement feels responsive and maintains speed for racing context.

- [ ] **PH-01**: Ball accelerates quickly when input is given (perceived responsiveness)
- [ ] **PH-02**: Ball has reduced friction for sliding feel appropriate to racing
- [ ] **PH-03**: Gravity maintained at -20.0 (no change from classic mode)
- [ ] **PH-04**: Ball bounces off walls with appropriate restitution
- [ ] **PH-05**: Linear velocity reset on entering race mode (no carryover from previous game)
- [ ] **PH-06**: Steering feels precise and immediate (no input lag)

### CHECKPOINT: Start/Finish and Checkpoint Tracking

User completes laps by crossing finish line and navigating checkpoints.

- [ ] **CP-01**: Checkpoint system detects when player crosses designated checkpoint zones
- [ ] **CP-02**: Lap count increments by 1 when player crosses finish line (not phantom increments)
- [ ] **CP-03**: Checkpoint crossing only counts from valid direction (forward progress, not backslide)
- [ ] **CP-04**: Multiple checkpoints per lap guide player along correct track path
- [ ] **CP-05**: Finish line is clearly marked visually and mechanically
- [ ] **CP-06**: Completing N laps (likely 3) triggers race completion

### HUD_RACE: Race-Specific UI and Feedback

User sees real-time race metrics and understands current status.

- [ ] **HUD-01**: Current speed displayed in real-time on HUD
- [ ] **HUD-02**: Current lap number displayed (e.g., "Lap 2/3")
- [ ] **HUD-03**: Current lap time displayed and updates each frame
- [ ] **HUD-04**: Best lap time tracked and displayed if improved
- [ ] **HUD-05**: Finish notification when race completes (visual + text)
- [ ] **HUD-06**: HUD elements readable during high-speed gameplay (no obscuration)

### BOOST: Boost Zones and Speed Mechanics

Player gains temporary speed boost by traversing designated boost tiles.

- [ ] **BOOST-01**: Boost zone tiles placed strategically on track
- [ ] **BOOST-02**: Crossing boost zone applies immediate velocity increase (1.5-2x speed)
- [ ] **BOOST-03**: Boost applies consistently regardless of approach angle or current speed
- [ ] **BOOST-04**: Boost can only trigger once per pass (no repeated triggering)
- [ ] **BOOST-05**: Visual feedback on boost activation (particle effect, color change, sound)

### COMPLETION: Race Completion and Results

When player finishes race, results are shown and game state is handled correctly.

- [ ] **RESULT-01**: Race end triggers when player completes final lap
- [ ] **RESULT-02**: Results screen shows final time and lap count
- [ ] **RESULT-03**: Best lap time persists in race results
- [ ] **RESULT-04**: Player can return to menu or start new race from results screen
- [ ] **RESULT-05**: Race state is properly cleaned up before returning to menu

### AUDIO: Sound and Music for Racing

Audio enhances racing immersion.

- [ ] **AUDIO-01**: Background music appropriate for race mode (energetic, fast-paced)
- [ ] **AUDIO-02**: Lap completion triggers audio cue (distinct, celebratory)
- [ ] **AUDIO-03**: Boost activation creates audio feedback
- [ ] **AUDIO-04**: Finish event triggers celebration audio

### MOBILE: Mobile Performance and Touch Support

Race mode performs acceptably on mobile devices.

- [ ] **MOB-01**: Race mode maintains minimum 30fps on standard mobile devices
- [ ] **MOB-02**: Particle effects quantity reasonable for mobile GPU
- [ ] **MOB-03**: Touch input controls work for racing (continuous steering)
- [ ] **MOB-04**: Screen resolution adapted for mobile viewport

### CONTENT: Track Content and Progression

Multiple track options with varying difficulty levels.

- [ ] **CONTENT-01**: At least 1 track fully implemented and playable for v2.2
- [ ] **CONTENT-02**: Track is thematically coherent (fits one of existing themes)
- [ ] **CONTENT-03**: Track difficulty is appropriate for single-player (challenging but achievable)
- [ ] **CONTENT-04**: Track layout encourages replay (skill-based progression possible)

---

## Future Requirements (Out of Scope for v2.2)

- Multiplayer racing support
- Multiple difficulty track variations
- Ghost mode (race against previous best time)
- Leaderboards
- Advanced visual effects: motion blur, tire tracks, weather
- Advanced AI opponents
- Track editor or customization UI

---

## Traceability: Requirements to Roadmap Phases

(To be populated during roadmap creation)

| Requirement ID | Phase | Status |
|---|---|---|
| GM-01 | Phase 1 | — |
| GM-02 | Phase 1 | — |
| TR-01 | Phase 1 | — |
| TR-02 | Phase 2 | — |
| PH-01 | Phase 2 | — |
| CP-01 | Phase 1 | — |
| HUD-01 | Phase 1 | — |
| BOOST-01 | Phase 2 | — |
| RESULT-01 | Phase 1 | — |
| AUDIO-01 | Phase 2 | — |
| MOB-01 | Phase 3 | — |
| CONTENT-01 | Phase 3 | — |

---

## Success Metrics (Definition of Done)

**For Milestone v2.2 to be considered complete:**

1. ✅ All requirements verified
2. ✅ Manual UAT passes: Playtest on desktop + mobile
3. ✅ Classic mode regression test passes
4. ✅ Performance verified: 60fps desktop, 30fps mobile
5. ✅ No P1 (critical) bugs

---

*Created: 2026-04-01*
- Performance optimization
- UI redesign

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONLINE-01 | 1 | Not Started |
| ONLINE-02 | 1 | Not Started |
| ONLINE-03 | 1 | Not Started |
| ONLINE-04 | 1 | Not Started |
| ONLINE-05 | 1 | Not Started |
| ONLINE-06 | 1 | Not Started |
| ONLINE-07 | - | Existing |
| ONLINE-08 | 2 | Not Started |
| ONLINE-09 | 2 | Not Started |
| ONLINE-10 | 2 | Not Started |
| ONLINE-11 | 1 | Not Started |
| ONLINE-12 | 1 | Not Started |

---

*Created: 2026-03-31 at v2.1 milestone start*
