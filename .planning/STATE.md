---
milestone: v2.3
created: 2026-04-28
---

# Dropfall v2.3 State

## Project Reference

**Core Value**: Make Dropfall accessible to mobile players with a premium touch-first experience while preserving the existing desktop experience unchanged.

**Current Focus**: Phase 1 - Responsive Layout Foundation

**Milestone**: v2.3 "First-Class Mobile Support"

## Current Position

**Phase**: Not started (defining roadmap)
**Plan**: —
**Status**: Milestone reset — creating roadmap
**Progress**: ░░░░░░░░░░ 0%

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Phases Complete | TBD | 0 |
| Plans Executed | TBD | 0 |
| Requirements Met | TBD | 0 |
| Desktop Regression | None | N/A |

## Accumulated Context

### Key Decisions
- Desktop layout unchanged on screens ≥1024px (media queries only affect mobile)
- Touch controls: virtual joystick + touch-drag alternative (research best methods)
- Performance target: 30fps minimum on mid-range mobile
- Touch latency target: <16ms (native-like feel)
- Remove boost button from UI
- Start with player options screen layout fix
- AR mode added via three.js ARButton (`immersive-ar` session), roomscale (floor) and tabletop (configurable height) modes

### Pending TODOs
- None

### Blockers
- None

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260428-qwy | Remove portals from game - comment out code for potential future use | 2026-04-28 | e173311 | [260428-qwy-remove-portals-from-game-comment-out-cod](./quick/260428-qwy-remove-portals-from-game-comment-out-cod/) |
| 260526-tmm | Add AR mode to Dropfall VR/headset rooms (roomscale + tabletop) | 2026-05-26 | dbe6b94, ed9029b | [260526-tmm-add-ar-mode-to-dropfall-vr-headset-rooms](./quick/260526-tmm-add-ar-mode-to-dropfall-vr-headset-rooms/) |

## Session Continuity

**Last Session**: 2026-05-26 - Completed quick task 260526-tmm: Add AR mode to Dropfall VR/headset rooms (roomscale + tabletop)
**Next Action**: Test AR mode on Meta Quest 2 headset (roomscale and tabletop)
**Context for Next Session**:
- AR mode: roomscale (arena on floor) and tabletop (arena at configurable height, default 0.75m)
- AR settings in Gameplay pane: AR Mode toggle, AR Mode Type dropdown, Table Height slider
- ARButton toggles with VRButton based on arMode setting
- Scene background goes transparent in AR (passthrough visible), restores on exit

---
*State initialized: 2026-04-28 for v2.3 Mobile Support milestone*
