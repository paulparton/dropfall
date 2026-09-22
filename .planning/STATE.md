---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Arena Foundation
status: executing
last_updated: "2026-09-22T06:10:00.000Z"
last_activity: 2026-09-22
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 1
  completed_plans: 0
  percent: 5
---

# Dropfall Arena v4.0 State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-22)

**Core Value**: Every round creates an immediate, legible contest of movement, timing, positioning, and ring-outs.

**Current Focus**: Phase 12 — Combat Foundation.

**Milestone**: v4.0 "Arena Foundation"

## Current Position

Phase: 12 — Combat Foundation
Plan: 12-01 — Combat Foundation Vertical Slice
Status: In progress; native build and runtime smoke test pass, awaiting player feel feedback
Last activity: 2026-09-22 — Implemented and launched the first v4.0 combat slice

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Editor build | Clean | Passed |
| PIE boot | Successful | Passed |
| Full AI match | First to 3 resolves | Passed (3–1) |
| Gameplay log errors | 0 project errors | Passed |
| Player feel UAT | Positive/rematch-worthy | Pending |

## Accumulated Context

### Key Decisions

- Dropfall Classic remains the web edition and design reference; Arena is a clean Unreal implementation.
- Local multiplayer and local versus AI are proven before online services.
- C++ owns simulation, match rules, future authority, and validation contracts.
- AI tiers change reaction and decisions, never fighter physics.
- Ads and monetization prompts are forbidden during active play.
- Paid storefront entitlement will disable all advertising through one product-level seam.

### Implemented in Current Slice

- Tunable fighter movement and boost contract.
- Normalized boost readiness for HUD/presentation.
- Speed-scaled fighter collision impulses with contact gating.
- Player 1 keyboard and gamepad input.
- Rookie, Rival, and Ace AI switching with `F2`.
- Clear point and match-winner states.

### Pending TODOs

- Tune acceleration, speed, boost, and collision impulse from hands-on player feedback.
- Complete independent two-controller input routing in Phase 13.
- Persist AI ladder records in Phase 14.
- Verify 60 fps budget as presentation/content grows.

### Blockers

- None.

## Session Continuity

**Next Action**: Gather player feel feedback on the running Phase 12 slice, tune combat, then complete controller/couch match flow in Phase 13.

---
*State updated: 2026-09-22 during Phase 12 execution*
