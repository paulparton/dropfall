# Phase 18 — maps, ramps and optional falling terrain

Implemented the user's core-gameplay priority ahead of presentation work.

- Three authored runtime maps: Foundry (16x16m), Crosswind (24x16m), Skyway
  (32x24m), with 2/4/6 physical launch ramps respectively.
- Pillars, angled barriers, long run-ups, ramp lip markings and tiled floors.
- Stable Arena keeps the whole floor. Fall Away warns for four seconds before
  outer floor bands drop at 30 seconds, then every 14 seconds. Supported pieces
  fall too; each round restores the full layout and collision.
- Independent setup selectors for map, terrain rule and opponent mode, locked
  throughout matches/runs. Camera scales to each map with the same input basis.
- Basic bot cover avoidance and retreat from warning floor bands.
- Separate local ladder boards per map/rule, preserving legacy save data.

See `18-VERIFICATION.md` for actual evidence and limitations. Classic code and
the unrelated `outputs/` directory are untouched.
