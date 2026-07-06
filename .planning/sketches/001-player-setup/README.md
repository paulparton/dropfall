---
sketch: 001
name: player-setup
question: "What visual design direction best elevates the player setup screen to AAA quality?"
winner: null
tags: [player-setup, character-select, customization, game-ui]
---

# Sketch 001: Player Setup

## Design Question
Which aesthetic direction makes the player setup screen feel premium and exciting — not a utility modal but a moment of anticipation before the match?

## How to View
```
open .planning/sketches/001-player-setup/index.html
```

## Variants

- **A: Mario Kart** — Bright blue sky, character grid with colored ball portraits, yellow star highlights, festive energy. Players each have their own panel with a roster of colored "characters" and hat accessories. Fredoka One font.
- **B: Rocket League** — Dark arena, electric perspective grid floor, neon blue/orange glow effects, minimal esports aesthetic. Color category tabs, clean swatch strip, crisp typography. Rajdhani font.
- **C: Splatoon** — Ink-splatter zones in each player's color fill the background. Playful bubble typography, ink blob color swatches, capsule hat chips. Boogaloo font.
- **D: Elden Ring** — Near-black atmospheric background with ember particles, ornamental gold dividers, gothic split-screen. Colors are "Bloodstones", hats are "Helms", lore flavor text per category. Cinzel Decorative font.
- **E: Overwatch** — Clean dark gallery with a full hero roster grid (all color+hat combos as named "heroes"). Filter by category. Auto-switches selecting player after each pick. Oswald font.

## Real Data Shapes Used
- 16 solid colors across 5 categories: neon, metallic, jewel, dark, special
- 6 hats: none, santa, cowboy, afro, crown, dunce (from `src/main.js`)
- Color data structure from `src/components/ColorPalette.ts`

## What to Look For
- Which variant makes you *excited* to play vs. just configure settings?
- Does the 2-player layout feel balanced, or does one player feel secondary?
- How well does each handle the large number of color options (16 shown, 30+ in real palette)?
- Which category filter/tab approach (B tabs, E filter bar) feels most natural for color selection?
- Elden Ring (D) uses lore flavor text — does that add charm or friction?
- Overwatch (E) auto-switches selecting player — does that feel smart or confusing?
