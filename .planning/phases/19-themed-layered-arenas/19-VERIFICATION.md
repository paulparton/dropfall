---
phase: 19
status: passed
date: 2026-09-22
scope: local themed multi-level gameplay draft
---

# Verification

## Build and source gates

- Installed engine metadata: Unreal 5.8.1, CL 56057345.
- Metal compiler found; platform validation reports Mac VALID, SDK 26.1.1.
- Editor Mac Development and native Game Mac Development compile with
  `-NoHotReloadFromIDE`. Installed-engine MetalShaderConverter include warning
  remains non-fatal. This is not a cooked or signed distribution build.
- `git diff --check` passes. Classic code and unrelated `outputs/` are untouched.

## Thirteen automated tests

All five prior combat/input/ladder/product tests, plus:

1. LayoutAndRampGeometry: bounds, spawn clearance, low-edge alignment, map IDs.
2. CollisionCollapseAndReset: actual traces, initial/middle/final floors,
   Stable mode, warnings and reset for all maps. Final core has 16 solid tiles.
3. SeparateLeaderboards: five records per map/rule, preserved old record, serialization.
4. BoostRampFlight: actual boosted ball clears a launch lip; apex 220.1cm.
5. LayerConnectivity: every upper deck has a flush connecting ramp with matching
   collapse lifetime; bot approaches a surviving core ramp for elevated targets.
6. LaunchPadPhysicsAndLifecycle: actual 320.3cm apex; lockout, under-deck rejection,
   warning-stage availability, disabled fallen pads, surviving core and reset.
7. PermanentTerraceTraversal: actual physics movement without boost reaches the
   permanent raised terrace on all three maps after both collapses.
8. SpherePhysicsParity: three imported skins load with two material slots,
   are visible and non-colliding, and preserve the root sphere and its scale.

Physics tests use isolated transient worlds, no Arena game mode or user save slot.
Latest headless log: `/tmp/dropfall-arena-layer-tests.log`.

## Asset gates

Background Blender 5.2 factory session left the unrelated open scene untouched.
Three original assets round-trip through FBX with correct metre scale, one UV
layer and Shell/Team slots. Unreal import verifies 47–54cm half extents and both
slots; final import commandlet exits successfully with zero errors and warnings.
Editable source `.blend`, deterministic generators, FBX and `.uasset` outputs
are retained together. No third-party artwork or textures.

## Rendered inspection

All three maps were rendered in a floating PIE window with their matching spheres.
Reviewed ramp approaches, deck height, pad arrows, team identification and themed
surfaces. Corrected excessive glow and the tall-map/HUD overlap after inspection.
Observed Foundry's red warning and final surviving terrace/core in live play.
Camera keeps its original rotation/input basis, fits the full starting arena,
then eases inward after collapse and restores full framing on reset.

## Limits / next playtest

This validates implementation, not competitive balance. Multi-level bot routing
is local waypoint steering, not a complete navigation planner. Full ladder runs,
two physical controllers, long-session frame pacing, pad landing balance and
competitive camera readability still need hands-on testing. Geometry and themes
are a first authored draft, not a final environment-art pass. No online or
storefront scope was added.
