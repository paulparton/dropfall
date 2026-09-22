# Phase 19 implementation

- Foundry (24x24m), Crosswind (32x24m), Skyway (32x32m).
- All are built core-first: permanent 16x16m floor, raised terrace, two ramps,
  two pads and cover; intermediate side galleries; outer starting extensions.
- Six/eight/ten ramps and four/six/eight pads. Tallest deck is 4.2m.
- Full -> middle at 30s -> final at 50s, with four-second warnings. The final
  core does not fall. Stable mode and rematch reset remain supported.
- Authored connection endpoints and common collapse layers prevent detached
  surviving routes; bots choose ramp approach waypoints for elevated opponents.
- Bounded automatic pad launch, height gate, per-fighter lockout, collapse reset.
- Original Forge, Turbine and Orbit Blender meshes. No third-party art. Cosmetic
  shells never replace physical bodies. Cyan/coral material channels remain visible.
- Metallic/emissive material, theme palettes, edge/route markings, forge backdrop,
  skyport setting and orbital star field. Camera adjusted for HUD safe area.
- Versioned map IDs preserve older leaderboard records separately.

Verification: 13 automated tests pass; editor and native Mac builds pass.
Blender clean-scene round-trips and Unreal imports validate scale and material
slots. Physics test apex: launch slope 220.1cm, pad 320.3cm; normal movement
reaches every map's surviving terrace. See verification for remaining limitations.
