---
status: passed
verified: 2026-09-22
---

# Phase 18 verification

## Automated evidence

Headless Unreal 5.8.1 automation: **9/9 passed** on 2026-09-22 at 09:29 UTC.
Log: `/tmp/dropfall-arena-phase18-tests.log`.

New tests:

- `Maps.LayoutAndRampGeometry`: distinct/increasing map sizes, clear spawn
  volumes, obstacle bounds, 2/4/6 ramps, flush entries and raised launch lips.
- `Maps.CollisionCollapseAndReset`: creates each actual runtime layout in a
  transient physics world. Traces hit the floor/ramp colliders; Stable retains
  all tiles past 1,000 seconds; warnings remain solid; the first ring removes
  collision at 30 seconds; all rings eventually fall; reset restores collision.
- `Maps.SeparateLeaderboards`: each of six map/rule boards independently retains
  five results, legacy records remain, map/rule identity survives serialization.
- `Maps.BoostRampFlight`: runs the real fighter and Foundry ramp through 90
  physics frames in an isolated game world, using normal movement and boost.
  Ball centre reaches 217.1cm, clears the lip, and is airborne beyond it.
  No Arena game mode, progress slot or artificial jump impulse is used.

The five prior camera, combat, ladder, save and monetization contracts also pass.

## Runtime observations

- Foundry, Crosswind and Skyway all rendered in PIE with distinct layouts,
  readable ramps/pillars/barriers and camera framing adapted to their size.
- E cycles maps, F switches terrain rules, and the selected name/rule appears in
  setup, in play, and on the appropriate leaderboard.
- Stable Arena HUD has no false collapse countdown.

## Build gates

- Mac SDK validated by UnrealBuildTool; Metal compiler available.
- Editor Mac Development: succeeded.
- Game Mac Development: succeeded and locally signed. Installed-engine
  MetalShaderConverter include-path warning did not prevent the build.

## Limits

- Ramp flight is physically simulated by automation, not a claim of exhaustive
  hands-on traversal of every ramp and collision approach.
- Bot steering is local obstacle avoidance, not full pathfinding; larger-map
  balance and recovery need playtesting.
- Physical controllers and every native mouse target retain their prior
  hands-on verification gaps.
- This is a development build, not a cooked/public distribution.
