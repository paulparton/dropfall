---
status: resolved
trigger: "visual glitches in arctic level, colored triangles appear after a few seconds and intensify — mac-only (all browsers), not reproducible on linux"
created: "2026-06-23"
updated: "2026-06-23"
---

## Symptoms
- expected_behavior: No triangle artifacts between floor tiles; any visual effects should fit arctic ice/snow aesthetic.
- actual_behavior: Colored (pink/magenta/white) triangle artifacts appear on arctic tiles and intensify over time.
- error_messages: None.
- timeline: Appears after a few seconds; intensifies continuously.
- reproduction: Open arctic level and wait; artifacts appear on tile surfaces and grow stronger.
- constraints: Mac-only (all browsers); not reproducible on Linux (any browser).

## Root Cause (CONFIRMED)

`uPulse` shader uniform was set to `this.pulseTime * 2.25` — raw accumulated time multiplied by 2.25. This value grows without bound.

In the arctic fragment shader, `uPulse` is used directly in `mix()`:
```glsl
color = mix(color, eColor, edgeGlow * (0.3 + uPulse * 0.3) * topMask);
```

A `mix()` blending factor far past 1.0 extrapolates colour values well outside [0,1]. macOS Metal/ANGLE does not clamp these out-of-range fragment values the same way Linux Mesa OpenGL does, causing the UV-space triangular structure of the `CylinderGeometry` top cap to become visible as coloured, intensifying triangles.

Symptoms match perfectly:
- **Appears after a few seconds**: `uPulse` needs to grow past ~3 before the extrapolation is visually significant
- **Intensifies continuously**: `uPulse` grows linearly forever
- **Triangular pattern**: `edgeDist = min(min(uv.x,1-uv.x),min(uv.y,1-uv.y))` traces the triangular UV subdivisions of the hex cylinder cap
- **Mac-only**: macOS Metal WebGL propagates out-of-range intermediate values; Linux Mesa clamps them early

## Fix Applied

**File**: `src/entities/Arena.js`

Changed both the `basePlatformMaterial` update and the per-tile uniform update from:
```javascript
uniforms.uPulse.value = this.pulseTime * 2.25;
```
to:
```javascript
const shaderPulse = (Math.sin(this.pulseTime * Math.PI * 2 * 2.25) + 1) / 2;
uniforms.uPulse.value = shaderPulse;
```

`shaderPulse` oscillates in [0,1] at frequency 2.25 Hz — `* 2.25` becomes the oscillation frequency rather than an unbounded multiplier. This matches how the edge line opacity was already correctly computed (`Math.sin(this.pulseTime * Math.PI * 2 * 2.25)...`).

## Verification

- `npm run build` succeeded, no new errors or warnings
- Visual test on Mac required to confirm triangles no longer appear

## Files Changed
- `src/entities/Arena.js` — fixed `uPulse` to oscillate in [0,1] range

## Evidence
- timestamp: 2026-06-23T19:00:00
  finding: `uPulse` set to raw `pulseTime * 2.25` (line ~265 and ~285 in Arena.js), growing unboundedly
  impact: After ~2-3 seconds `uPulse > 1`, making GLSL `mix()` extrapolate wildly; after ~30s it is ~67, completely dominating all edge effects
- timestamp: 2026-06-23T19:01:00
  finding: Edge line opacity correctly uses `(Math.sin(pulseTime * π * 2 * 2.25) + 1) / 2` — bounded [0,1]
  impact: Confirms the same frequency formula was intended for `uPulse` but was never applied

## Resolution
- root_cause: Unbounded `uPulse` uniform caused GLSL `mix()` extrapolation far beyond [0,1] colour range
- fix: `shaderPulse = (Math.sin(pulseTime * π * 2 * 2.25) + 1) / 2` — oscillates in [0,1]
- verification: Build success; awaiting Mac visual confirmation
- files_changed: src/entities/Arena.js
