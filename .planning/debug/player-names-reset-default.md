---
slug: player-names-reset-default
status: fixed
trigger: "The player names aren't working in the game. When i start a local multiplayer the names are set to 'player 1' and 'player 2', i can type in a new name, but it resets to player 1 and player 2 in the game, and is player 1 and player 2 when you return to the new game screen"
created: 2026-07-06
updated: 2026-07-06
fixed: 2026-07-06
---

## Symptoms

- **Expected**: Custom player name typed in the input should appear in-game (HUD, 3D name label above ball) and persist when returning to the setup screen
- **Actual**: Name shows correctly in the CharacterPreviewPanel input, but when game starts it shows "Player 1" / "Player 2", and those defaults are also shown when returning to the setup screen
- **Error messages**: None
- **Timeline**: Likely since CharacterPreviewPanel replaced inline input fields in index.html
- **Reproduction**: Open game → select 2P mode → type custom name in the preview panel → click READY UP → observe "Player 1" / "Player 2" in-game

## Current Focus

- **Hypothesis**: `proceedFromNameEntry()` in `src/main.js:592,599` reads names from `#p1-name-input` / `#p2-name-input` DOM elements which no longer exist (CharacterPreviewPanel replaced them). The `?.value` returns `null`, so the `|| 'Player 1'` fallback always triggers, overwriting the store with defaults.
- **Test**: Read `state.p1Name` from the store inside `proceedFromNameEntry()` instead of DOM. Verify the store already has the correct name from `CharacterPreviewPanel`'s `oninput` → `setPlayerNames`.
- **Expecting**: `useGameStore.getState().p1Name` already contains the custom name at the time `proceedFromNameEntry()` runs
- **Next action**: Read store state in `proceedFromNameEntry()` and confirm names are present; then fix to read from store instead of DOM

## Evidence

- `src/main.js:592`: `document.getElementById('p1-name-input')?.value.trim() || 'Player 1'` — element `#p1-name-input` does NOT exist in current `index.html`
- `src/main.js:599`: Same for `#p2-name-input`  
- `index.html:460-475`: Name entry screen uses `#character-preview-mount` div, no `#p1-name-input` elements
- `src/components/CharacterPreviewPanel.ts:613-621`: `oninput` handler calls `setPlayerNames(nextName, ...)` — store IS updated correctly
- `src/main.js:2069-2109`: When NAME_ENTRY state is entered, the CharacterPreviewPanel reads from `state.p1Name` / `state.p2Name` — but these were already overwritten with defaults by `proceedFromNameEntry()`
- Also `src/main.js:983-987`: `keydown` listeners on `#p1-name-input` / `#p2-name-input` that don't exist — dead code
- Fixed: `proceedFromNameEntry()` now reads `state.p1Name` / `state.p2Name` from store instead of DOM
- Fixed: Removed dead keydown listeners on `#p1-name-input` / `#p2-name-input`
- Dead CSS rules for `#p1-name-input, #p2-name-input` remain in `src/style.css:779-795` (harmless)

## Eliminated

(none yet)

## Resolution

- **Root Cause**: `proceedFromNameEntry()` in `src/main.js:592,599` reads names from `#p1-name-input` / `#p2-name-input` DOM elements which no longer exist (CharacterPreviewPanel replaced them). `?.value` returns `null`, so the `|| 'Player 1'` / `|| 'Player 2'` fallback always triggers, overwriting the store with defaults. Meanwhile, the CharacterPreviewPanel's `oninput` handler correctly writes the typed name to the store via `setPlayerNames()`, but `proceedFromNameEntry()` then overwrites it with the fallback defaults.
- **Fix**: Changed `proceedFromNameEntry()` to read `state.p1Name` / `state.p2Name` directly from the store instead of from the non-existent DOM elements. Also removed dead keydown listeners on `#p1-name-input` / `#p2-name-input`.
