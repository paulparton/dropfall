---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Arena Foundation
status: ready_for_playtest
last_updated: "2026-09-22T08:30:00.000Z"
last_activity: 2026-09-22
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Dropfall Arena v4.0 State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-22)

**Core Value**: Every round creates an immediate, legible contest of movement,
timing, positioning, and ring-outs.

**Current Focus**: Arena-only playtesting and presentation polish after Phase 17.

**Milestone**: v4.0 "Arena Foundation"

## Current Position

Phase: 17 — Solo Ladder and Front End
Plan: 17-01 implemented
Status: Ready for hands-on follow-up; not a verified public release
Last activity: 2026-09-22 — Solo ladder, local board, match menus and camera/layout fixes

## Verification

| Gate | Result |
|------|--------|
| Editor target | Passed |
| Native Mac game target | Passed |
| Arena automation suite | 5/5 passed |
| PIE ready/countdown/play loop | Passed |
| First-to-three and rematch | Passed |
| Camera-relative input contract | Passed |
| Ladder progression/ranking/save roundtrip | Passed |
| Physical two-controller and full native mouse coverage | Pending hands-on |

## Delivered

- Camera-relative keyboard and controller movement.
- Responsive physics combat, boosts, impacts, lighting, and procedural tones.
- Safe ready screen, countdown, round timer, scoring, match win, and rematch.
- Keyboard plus two-controller couch play on a shared camera.
- Rookie/Rival/Ace AI tiers with persistent local wins and streaks.
- Three-opponent solo runs with failure/retry and a persistent local top-five board.
- Practice/ladder/couch setup and results navigation.
- Tunable arena geometry and Sudden Drop shrinking platform.
- Monetization policy/paid entitlement seams with automated enforcement.
- Editor and standalone game build compatibility.

## Next Playtest Questions

- Does acceleration feel immediate without becoming slippery?
- Is boost strong enough to create reads without becoming the only viable action?
- Are impact knockbacks predictable and recoverable?
- Should Sudden Drop begin earlier or later than 30 seconds?
- How large should the next visual/content pass be before online work begins?

## Deferred Items

All Classic work, including nine historical open artifacts, is deferred by
explicit user instruction. See `CLASSIC-DEFERRED.md` for the durable list.

## Verification limits

Phases 12–15 have no individual verification reports. The earlier all-complete
claim exceeds the recorded evidence. Phase 16 records aggregate validation;
new work will record its own results without retroactively asserting coverage.

---
*Implementation progress counts are not a claim of complete release verification.*
