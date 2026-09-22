---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Arena Foundation
status: ready_for_playtest
last_updated: "2026-09-22T10:12:00.000Z"
last_activity: 2026-09-22
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Dropfall Arena v4.0 State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-22)

**Core Value**: Every round creates an immediate, legible contest of movement,
timing, positioning, and ring-outs.

**Current Focus**: Phase 19 — themed spheres and layered arenas built around a permanent final core.

**Milestone**: v4.0 "Arena Foundation"

## Current Position

Phase: 19 — Themed Layered Arenas
Plan: 19-01 implemented
Status: Ready for multi-level playtesting and route/launch tuning
Last activity: 2026-09-22 — Original themed spheres, layered collapse, connecting ramps and launch pads; 13 tests pass

## Verification

| Gate | Result |
|------|--------|
| Editor target | Passed |
| Native Mac game target | Passed |
| Arena automation suite | 13/13 passed |
| PIE ready/countdown/play loop | Passed |
| First-to-three and rematch | Passed |
| Camera-relative input contract | Passed |
| Ladder progression/ranking/save roundtrip | Passed |
| Maps, ramp collision/flight, falling-floor reset and separate boards | Passed |
| Surviving terrace traversal, pad lifecycle, cosmetic collision parity | Passed |
| Blender round-trip / Unreal bounds and material slots | Passed |
| Physical two-controller and full native mouse coverage | Pending hands-on |

## Delivered

- Camera-relative keyboard and controller movement.
- Responsive physics combat, boosts, impacts, lighting, and procedural tones.
- Safe ready screen, countdown, round timer, scoring, match win, and rematch.
- Keyboard plus two-controller couch play on a shared camera.
- Rookie/Rival/Ace AI tiers with persistent local wins and streaks.
- Three-opponent solo runs with failure/retry and a persistent local top-five board.
- Practice/ladder/couch setup and results navigation.
- Themed Foundry/Crosswind/Skyway maps with 6/8/10 ramps and 4/6/8 launch pads.
- Forge/Turbine/Orbit sphere shells retain identical physics and team identification.
- Full starting arena -> intermediate cross/galleries -> permanent elevated combat core.
- Optional Fall Away at 30s/50s with warning and reset; Stable Arena never collapses.
- Monetization policy/paid entitlement seams with automated enforcement.
- Editor and standalone game build compatibility.

## Next Playtest Questions

- Does acceleration feel immediate without becoming slippery?
- Is boost strong enough to create reads without becoming the only viable action?
- Are impact knockbacks predictable and recoverable?
- Do 30s/50s collapses leave enough time to use the upper decks?
- Are pad directions and landing zones useful without feeling automatic or unfair?
- Are balls and route markings readable at the larger shared-camera distance?
- Are the permanent core and elevated AI routes fun through a whole ladder run?

## Deferred Items

All Classic work, including nine historical open artifacts, is deferred by
explicit user instruction. See `CLASSIC-DEFERRED.md` for the durable list.

## Verification limits

Phases 12–15 have no individual verification reports. The earlier all-complete
claim exceeds the recorded evidence. Phase 16 records aggregate validation;
new work will record its own results without retroactively asserting coverage.

---
*Implementation progress counts are not a claim of complete release verification.*
