---
slug: color-swatch-oval-fix
status: resolved
trigger: manual
created: 2026-06-30
---

# Debug Session: Color Swatch Oval Fix

## Symptoms

1. Color picker swatches in the GAME SETTINGS / character setup screen appear as squished ovals/ellipses instead of perfect circles.
2. Border styling differs between the implementation and the sketch design.
3. Layout/structure differences: "GAME SETTINGS" vs "PLAYER SETUP" title.

## Current Focus

**hypothesis:** CONFIRMED — the swatch buttons inherit global `button { padding: 1rem 2rem }` from style.css because the inline swatch CSS does not override `padding`. This causes the element to be wider than tall, so `border-radius: 50%` produces an ellipse.

**next_action:** COMPLETE — fix applied.

## Evidence

- timestamp: 2026-06-30T00:00:00Z
  file: src/components/CharacterPreviewPanel.ts lines 758-769
  observation: Swatch inline cssText sets width/height/min-height but no padding or box-sizing override.

- timestamp: 2026-06-30T00:00:00Z
  file: src/style.css line 47
  observation: Global rule `button { padding: 1rem 2rem; ... }` applies 16px top/bottom + 32px left/right to ALL buttons.
  impact: Swatch computed size = (26px width + 64px padding) x (26px height + 32px padding) = 90x58px. border-radius:50% on non-square = ellipse.

## Resolution

root_cause: Color swatch buttons inherit global `button { padding: 1rem 2rem }` CSS rule. The inline swatch style set width/height/min-height but omitted `padding: 0` and `box-sizing: border-box`, causing the rendered element to be 90x58px instead of 26x26px. `border-radius: 50%` on a non-square box produces an ellipse.

fix: Added `padding: 0; box-sizing: border-box; min-width: 26px;` to the swatch inline CSS in CharacterPreviewPanel.ts at the swatch.style.cssText block (renderSwatches function). This forces the swatch to a perfect 26x26px square so border-radius: 50% renders a perfect circle.
