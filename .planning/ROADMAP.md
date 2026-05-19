---
version: 2.2
milestone: v2.2 Single-Player Race Mode
created: 2026-04-01
phases: 3
---

# Dropfall v2.2 Roadmap: Single-Player Race Mode

**Milestone Goal:** Introduce a second game mode offering racing gameplay with Mario Kart-style track design using existing ball physics and tile mechanics.

---

## Phase 7: Race Mode Fundamentals

**Goal:** Establish core racing infrastructure—game mode selection, basic playable track, checkpoint/lap system, and race-specific HUD.

**Duration:** 3-4 days  
**Status:** 📋 Planning

**Requirements Mapped:**
- [x] **GM-01**: User can select "Race Mode" from main game mode selection menu
- [x] **GM-02**: System initializes Race state when entering race mode
- [x] **TR-01**: Race track rendered with hexagonal tiles forming a navigable path
- [x] **TR-05**: Track layout supports Mario Kart-style flow
- [x] **CP-01**: Checkpoint system detects when player crosses designated zones
- [x] **CP-02**: Lap count increments by 1 when player crosses finish line
- [x] **CP-05**: Finish line is clearly marked visually
- [x] **HUD-01**: Current speed displayed in real-time on HUD
- [x] **HUD-02**: Current lap number displayed
- [x] **HUD-03**: Current lap time displayed and updates each frame
- [x] **RESULT-01**: Race end triggers when player completes final lap
- [x] **RESULT-02**: Results screen shows final time and lap count

**Success Criteria:**
1. Player can select "Race" from game mode menu
2. Race mode initializes without crashing or corrupting state
3. Basic track renders and is navigable (at least 3 turns)
4. Laps count correctly (1 lap = 1 cross of finish line, no phantom counts)
5. HUD displays speed, lap number, and time accurately
6. Race completes when player finishes lap 3
7. Results screen displays with correct metrics

**Plans:** 2-3

---

## Phase 8: Physics & Gameplay Polish

**Goal:** Tune physics for racing feel, implement boost zones, add visual/audio feedback, and ensure responsive controls.

**Duration:** 3-4 days  
**Status:** 📋 Planning

**Requirements Mapped:**
- [x] **PH-01**: Ball accelerates quickly when input is given
- [x] **PH-02**: Ball has reduced friction for sliding feel
- [x] **PH-04**: Ball bounces off walls with appropriate restitution
- [x] **PH-05**: Linear velocity reset on entering race mode
- [x] **PH-06**: Steering feels precise and immediate
- [x] **TR-02**: Track includes straightaways and turns
- [x] **TR-03**: Track includes elevation changes
- [x] **TR-04**: Walls/obstacle tiles that player bounces off
- [x] **CP-03**: Checkpoint crossing only counts from valid direction
- [x] **CP-04**: Multiple checkpoints per lap guide player
- [x] **CP-06**: Completing N laps (3) triggers race completion
- [x] **BOOST-01**: Boost zone tiles placed strategically on track
- [x] **BOOST-02**: Crossing boost zone applies immediate velocity increase
- [x] **BOOST-03**: Boost applies consistently
- [x] **BOOST-04**: Boost can only trigger once per pass
- [x] **BOOST-05**: Visual feedback on boost activation
- [x] **HUD-04**: Best lap time tracked and displayed
- [x] **HUD-05**: Finish notification when race completes
- [x] **AUDIO-01**: Background music appropriate for race mode
- [x] **AUDIO-02**: Lap completion triggers audio cue
- [x] **AUDIO-03**: Boost activation creates audio feedback
- [x] **AUDIO-04**: Finish event triggers celebration audio
- [x] **RESULT-03**: Best lap time persists in race results
- [x] **RESULT-04**: Player can return to menu or start new race

**Success Criteria:**
1. Input-to-visual latency < 50ms (responsive steering)
2. Ball friction tuned properly for racing feel
3. Boost zones apply consistently, no phantom triggers
4. Wall bounces feel fair
5. Checkpoint system validates direction
6. All audio cues distinct
7. Best lap time correctly tracked
8. Playtest feedback: Racing feels fun and skill-based

**Plans:** 3-4

---

## Phase 9: Content & Validation

**Goal:** Finalize track content, optimize for mobile, conduct full UAT, and verify no regression in classic mode.

**Duration:** 3-4 days  
**Status:** 📋 Planning

**Requirements Mapped:**
- [x] **GM-03**: Classic mode unaffected when switching to/from Race mode
- [x] **GM-04**: Game returns to mode selection after race completes
- [x] **TR-06**: One initial track design available for v2.2
- [x] **HUD-06**: HUD elements readable during high-speed gameplay
- [x] **MOB-01**: Race mode maintains minimum 30fps on mobile
- [x] **MOB-02**: Particle effects quantity reasonable for mobile GPU
- [x] **MOB-03**: Touch input controls work for racing
- [x] **MOB-04**: Screen resolution adapted for mobile viewport
- [x] **CONTENT-01**: At least 1 track fully implemented and playable
- [x] **CONTENT-02**: Track is thematically coherent
- [x] **CONTENT-03**: Track difficulty appropriate for single-player
- [x] **CONTENT-04**: Track layout encourages replay
- [x] **RESULT-05**: Race state properly cleaned up before returning to menu

**Success Criteria:**
1. Desktop: 60fps maintained during gameplay
2. Mobile: 30fps maintained on standard devices
3. Touch controls responsive
4. HUD readable during high-speed sections
5. Track completable by first-time player
6. Skilled player can complete in <1.5 min
7. No P1 bugs in UAT
8. Classic mode regression test passes
9. External playtest positive feedback

**Plans:** 2-3

---

## Phase Dependencies

| Phase | Dependencies | Notes |
|-------|--------------|-------|
| 7 | None | Core infrastructure |
| 8 | Phase 7 | Physics, gameplay feel |
| 9 | Phases 7+8 | Content, optimization, validation |

---

## Requirement Traceability

| Category | Phase 7 | Phase 8 | Phase 9 | Total |
|----------|---------|---------|---------|-------|
| GAME_MODE | 2 | 1 | 1 | 4 |
| TRACK | 1 | 4 | 1 | 6 |
| PHYSICS | 0 | 6 | 0 | 6 |
| CHECKPOINT | 3 | 3 | 0 | 6 |
| HUD_RACE | 3 | 2 | 1 | 6 |
| BOOST | 0 | 5 | 0 | 5 |
| COMPLETION | 2 | 1 | 2 | 5 |
| AUDIO | 0 | 4 | 0 | 4 |
| MOBILE | 0 | 0 | 4 | 4 |
| CONTENT | 0 | 0 | 4 | 4 |
| **Total** | **11** | **26** | **13** | **50** |

---

## Key Milestones

**Phase 7 → 8 Gate:**
- Track renders and is playable
- Checkpoint system working (no phantom counts)
- Mode can be entered/exited cleanly

**Phase 8 → 9 Gate:**
- Physics feel good (playtester feedback positive)
- Boost system working
- Audio fully integrated
- No critical bugs

**Milestone Complete Gate:**
- UAT passed
- No classic mode regression
- Mobile tested on ≥2 device types
- Performance targets met

---

*Created: 2026-04-01*  
*Continuing from v2.1 (Phase 6)*

