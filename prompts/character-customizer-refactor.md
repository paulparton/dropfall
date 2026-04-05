---
mode: agent
description: Refactor the character customizer in the game settings screen
---

# Character Customizer Refactor

You are refactoring the character customization UI in a browser-based 3D ball game called Dropfall. The game uses Three.js for rendering, Zustand for state management, and vanilla TypeScript/JS for UI components. All UI is built with DOM elements — there is no React.

## Context

The character customizer lives on the "Game Settings" screen (`NAME_ENTRY` game state), where players enter their names, choose ball colors, pick hats, and see a live 3D preview of their ball before starting a round.

**There are two parallel systems that need to be unified:**

1. `src/components/CharacterPreviewPanel.ts` — The newer dual-preview panel with side-by-side 3D canvases, mounted into `#character-preview-mount` in `index.html`. This is the active system.
2. `src/components/CustomizationModal.ts` — An older single-player modal with a flat color grid. This is still imported and used for between-round customization in the `CUSTOMIZATION` game state in `src/main.js`.

**Relevant files:**
- `src/components/CharacterPreviewPanel.ts` — Dual preview panel (active, but broken color picker)
- `src/components/ColorPalette.ts` — Color definitions (12 colors across 4 categories: neon, dark, metallic, jewel)
- `src/components/CustomizationModal.ts` — Legacy single-player modal (still used between rounds)
- `src/entities/Player.js` — Contains `_createHat()` (line ~554) and `_updateHatPhysics()` (line ~904) with full Three.js hat meshes and physics
- `src/store.ts` — Zustand store with `p1Color`, `p2Color`, `p1Hat`, `p2Hat`, `setPlayerColors()`, `setPlayerHats()`
- `src/main.js` — Mounts the preview panel in the `NAME_ENTRY` case (~line 1395) and handles `CUSTOMIZATION` state (~line 1325)
- `index.html` — Contains `#name-entry` screen layout, `#character-preview-mount`, hat `<select>` elements, name inputs
- `src/style.css` — Existing `.hat-select` styles

**Store state shape (from `src/store.ts`):**
```typescript
p1Color: number;  // hex like 0xff0000
p2Color: number;
p1Hat: string;    // 'none' | 'santa' | 'cowboy' | 'afro' | 'crown' | 'dunce'
p2Hat: string;
```

**Available hat types with their Three.js geometries in `Player._createHat()`:**
- `santa` — Multi-segment floppy cone with pompom, uses spring physics for droop
- `cowboy` — Leather brim + crown with buckle band, lathe geometry
- `afro` — Sphere core with lumps
- `crown` — Gold tiered crown with gems
- `dunce` — Simple cone

## Current Problems

### Problem 1: Color picker is broken and poorly scoped

The `CharacterPreviewPanel.ts` renders one shared color picker at the bottom of the panel. The `swatch.onclick` handler is empty — it calls `onPlayerStateChange` but never passes a player ID or color value. The color picker also renders as a large 6-column grid with scroll arrows that don't work well (they hide/show swatches via `display: none` which breaks the grid).

**Root cause:** The color picker has no concept of "which player is selected" and the `onclick` handler is a stub with a comment saying "This will be handled by the parent panel."

### Problem 2: Hat preview shows emoji text, not actual hat meshes

The `CharacterPreviewPanel.ts` renders hats as emoji text (🎅, 🤠, 👑) in a DOM `<div>` above the canvas. The actual hat meshes from `Player._createHat()` are never rendered in the preview scene. The `_updateHatPhysics()` method that makes hats tilt, bob, wobble, and droop based on ball velocity is also not used.

### Problem 3: Layout is cluttered and unintuitive

The current layout stacks: name inputs → hat dropdowns → preview panel (which internally stacks: difficulty → player cards → color picker). This creates a disjointed experience where related controls (a player's name, preview, color, hat) are scattered across different areas. The single shared color picker at the bottom is confusing.

## Required Changes

### 1. Per-player inline color picker

Each player card should contain its own compact, single-row, horizontally-scrollable color strip below the 3D preview canvas.

**Behavior:**
- Render all 12 colors from `ColorPalette.ts` in a single horizontal row that overflows with `overflow-x: auto` and smooth scroll-snap
- Tapping a color swatch immediately calls `onPlayerStateChange(playerId, { color: hexValue })` with the correct player ID
- The preview ball and aura update instantly via the existing `updatePreviewColor()` function
- The player card's border color and color indicator bar update to match the selected color
- The currently selected swatch gets a visible highlight ring (e.g. 3px solid yellow border)
- Remove the shared bottom color picker section entirely

### 2. Render actual hat meshes in preview

Replace the emoji-based hat display with real Three.js hat geometry rendered in the preview canvas, with physics simulation.

**Implementation approach:**
- Extract the hat creation logic from `Player._createHat()` into a shared function or import it directly
- When a hat is selected, create the hat group and add it to the preview scene
- Adapt `_updateHatPhysics()` to work with the preview ball's simulated velocity (the preview already has `ballVelocity` and animation loop)
- The hat should sit on top of the preview ball, tilt when the ball changes direction, bob with movement, and wobble at speed — matching in-game behavior
- When hat selection changes, dispose of the old hat group and create the new one
- The hat dropdown `<select>` elements in `index.html` should trigger a re-render of the hat in the preview

### 3. Layout redesign to match mockup

Restructure the `#name-entry` screen to a clean two-column layout:

```
┌──────────────────────────────────────┐
│         [Easy] [Medium] [Baller]     │  ← Difficulty (1P only)
├──────────────────┬───────────────────┤
│      ┌────────┐  │  ┌────────┐       │
│      │ P1 Name│  │  │ P2 Name│       │
│      ├────────┤  │  ├────────┤       │
│      │        │  │  │        │       │
│      │ 3D Ball│  │  │ 3D Ball│       │
│      │ Preview│  │  │ Preview│       │
│      │  +Hat  │  │  │  +Hat  │       │
│      │        │  │  │        │       │
│      ├────────┤  │  ├────────┤       │
│      │ Colors │  │  │ Colors │       │
│      │ ●●●●●● │  │  │ ●●●●●● │       │
│      ├────────┤  │  ├────────┤       │
│      │Hat Drop│  │  │Hat Drop│       │
│      └────────┘  │  └────────┘       │
├──────────────────┴───────────────────┤
│          [ Let's Roll! ]             │
└──────────────────────────────────────┘
```

**Each player card is a self-contained column containing (top to bottom):**
1. Name input field
2. 3D preview canvas (ball rolling with hat rendered via Three.js)
3. Horizontal single-row scrollable color strip
4. Hat selector dropdown

**Layout rules:**
- Move name inputs and hat selectors from their current separate rows in `index.html` into the player cards generated by `CharacterPreviewPanel.ts`
- Difficulty selector stays above the two columns (single-player only)
- "Let's Play!" and "Back" buttons stay at the bottom
- Use `flexbox` with `flex: 1` for the two columns, `gap: 1-2rem`
- Ensure the layout works at 1024x768 minimum without scrolling

## Constraints

- Preserve the existing neon/cyberpunk visual theme (cyan borders, dark backgrounds, glow effects, `Courier New` monospace font)
- Keep using the Zustand store for state — call `useGameStore.getState().setPlayerColors()` and `setPlayerHats()` to persist choices
- Do not break the `CUSTOMIZATION` game state flow used between rounds (the `CustomizationModal.ts` is used there separately)
- Maintain the existing `PreviewPlayerState` interface and `onPlayerStateChange` callback pattern
- The preview ball animation (rolling, bouncing off boundaries, direction changes) must continue working
- Dispose of Three.js resources properly when the panel is unmounted (renderers, geometries, materials)
- Match existing code style: TypeScript for components, inline styles via `.style.cssText`, DOM manipulation patterns

## Verification

After implementation, confirm:
- [ ] Selecting a color for Player 1 only changes Player 1's ball and livery — Player 2 is unaffected
- [ ] Selecting a color for Player 2 only changes Player 2's ball and livery — Player 1 is unaffected
- [ ] Selecting a hat shows the actual Three.js hat mesh on the preview ball
- [ ] The hat tilts, bobs, and wobbles as the preview ball moves
- [ ] Changing hats cleanly swaps the mesh with no visual artifacts
- [ ] The layout has two distinct player columns with all controls self-contained
- [ ] Colors and hats persist to the store and are used when the game starts
- [ ] No console errors or Three.js disposal warnings on screen transitions
- [ ] Works in both 1P (vs AI) and 2P modes
