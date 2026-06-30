---
slug: player-panel-border-fix
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-06-30
---

# Debug Session: player-panel-border-fix

## Symptoms
The player setup screen has individual bordered boxes around each player panel (P1 and P2).
The sketch design shows there should be NO individual box borders — instead just a single
vertical dividing line down the middle separating P1 from P2.

- P1 and P2 each rendered with a rectangular border box (card style)
- Box shadow on each card
- Arena selector also has a cyan bordered box
- Target: flat open layout, only a center divider line between P1/P2

## Current Focus

**hypothesis:** The `createPlayerCard()` function in `CharacterPreviewPanel.ts` applies
`border: 1px solid rgba(accentRgb, 0.35)`, `border-radius: 10px`, and `box-shadow`
inline styles to each card element. These need to be removed. A center divider should
be introduced between the two panels.

**next_action:** Apply fix — remove border/border-radius/box-shadow from card style,
replace gap between players with a 1px vertical divider line.

## Evidence

- timestamp: 2026-06-30T00:00:00Z
  file: src/components/CharacterPreviewPanel.ts
  lines: 533-546
  note: card.style.cssText sets border, border-radius, box-shadow on each player card

## Resolution

**root_cause:** Inline CSS on player card elements includes `border`, `border-radius`,
and `box-shadow` properties that render each panel as a visually distinct bordered card.
The `playersContainer` uses `gap: 2rem` with no divider element.

**fix:** Removed border, border-radius, and box-shadow from player card. Changed
`playersContainer` gap to 0. Added a 1px vertical divider div between the two panels.
