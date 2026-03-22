---
feature: single-player-mode-with-ai
version: 1
created: 2026-03-22
status: planning
---

# Single Player Mode with NPC Opponent

## Overview

Add single player gameplay where Player 2 is an AI opponent with configurable difficulty levels. Players will select game mode (1P vs 2P) and difficulty before each round.

## Feature Breakdown

### 1. **Menu System Enhancement**
Create UI to select between 1-player and 2-player modes, with difficulty selection for 1-player.

**Files to modify:**
- `index.html` — Add game mode and difficulty selection UI
- `src/store.js` — Add gameMode and difficulty to store state

**What to build:**
- Add buttons/menu for: "1 Player" / "2 Players"
- If 1-player selected, show difficulty selector: "Easy" / "Normal" / "Hard"
- Store selected mode and difficulty in game state

**Verification:**
- Menu displays mode/difficulty options
- User can select and continue to name entry
- Selected values persist in Zustand store

---

### 2. **AI Controller System**
Create a decision-making system that generates control inputs for the NPC player.

**Files to create:**
- `src/ai/AIController.js` — Main AI logic

**What to build:**
- `AIController` class with methods:
  - `update(playerPos, npcPos, arenaCenter, arenaRadius)` — Called each frame
  - `getInput()` — Returns `{ up, down, left, right, boost }` object (matches human controller format)
- Difficulty-based parameters:
  - **Easy**: 40% accuracy, 200ms reaction delay, avoids edges 60% of time
  - **Normal**: 70% accuracy, 100ms reaction delay, avoids edges 80% of time
  - **Hard**: 95% accuracy, 30ms reaction delay, aggressive pushing

**Implementation approach:**
- Calculate target direction toward opponent
- Vary accuracy by adding random offset (difficulty-dependent)
- Queue decisions with reaction delay to simulate human latency
- Implement "edge awareness" — NPC avoids getting knocked off (especially on higher difficulties)
- Use boost strategically when close to opponent or at low health

**Verification:**
- `getInput()` returns valid control object
- AI moves toward player in test scenarios
- Difficulty parameter changes behavior observable

---

### 3. **Game Loop Integration**
Wire AI controller into main game loop instead of Player 2 keyboard input.

**Files to modify:**
- `src/main.js` — Import AI, instantiate for 1P mode
- `src/input.js` — Conditionally use AI input when 1P mode active

**What to build:**
- Check `gameMode` in store
- If 1-player:
  - Instantiate `AIController` with active difficulty
  - In each frame update, call `aiController.update()` and `aiController.getInput()`
  - Pass result to player2 movement logic (same as human input would go)
- If 2-player:
  - Use existing keyboard/gamepad input for player2

**Verification:**
- 1P game starts without crash
- AI player2 moves and interacts with physics
- 2P mode still works unchanged
- Input source switches correctly

---

### 4. **Player Name Handling**
Update name entry to reflect single/multi player mode.

**Files to modify:**
- `src/main.js` — Update UI for name entry phase

**What to build:**
- If 1-player: Only ask for player 1 name, set player 2 to "NPC [Difficulty]" (e.g., "NPC Hard")
- If 2-player: Ask for both names as currently done

**Verification:**
- 1P mode shows only one name input
- Name field populates with "NPC [Difficulty]"
- 2P mode shows both name inputs

---

### 5. **AI Edge Awareness (Advanced)**
Make NPC smarter about arena edges and knockoff risk.

**Files to modify:**
- `src/ai/AIController.js` — Add edge detection logic

**What to build:**
- Calculate distance to arena edges
- When near edge (<2 units), prioritize:
  - Moving toward arena center
  - Avoiding collision vectors from opponent
  - On higher difficulties: occasional aggressive push when confident
- On lower difficulties: Always retreat to center if near edge

**Verification:**
- AI doesn't get knocked off easily on Normal/Hard
- Easy difficulty AI occasionally gets knocked off
- Edge-awareness observable in gameplay

---

## Task Execution Order (Waves)

| Wave | Task | Dependencies |
|------|------|--------------|
| 1 | Menu UI + Store State | None |
| 1 | AI Controller System | None |
| 2 | Game Loop Integration | Wave 1 complete |
| 2 | Player Name Handling | Wave 1 complete |
| 3 | Edge Awareness Enhancement | Wave 2 complete |

Wave 1 and 2 tasks can run in parallel (no dependencies between them in each wave).

---

## Testing Checklist

- [ ] Menu displays 1P/2P selector
- [ ] Difficulty menu appears only in 1P mode
- [ ] AI controller instantiates without errors
- [ ] AI player moves each frame in 1P game
- [ ] Player 1 can hit AI player 2
- [ ] AI player can knock Player 1 off arena
- [ ] Different difficulties show different AI behavior
- [ ] 2P mode still works normally
- [ ] Name entry adapts to game mode
- [ ] Win/lose conditions trigger correctly in 1P mode

---

## Success Criteria

✓ User can select 1-player or 2-player from main menu
✓ 1-player mode shows difficulty selector (Easy/Normal/Hard)
✓ AI opponent moves intelligently toward player
✓ AI difficulty affects accuracy, reaction time, and tactics
✓ Physics interactions work (AI gets knocked off, knockoff detects AI)
✓ 2-player mode unaffected
✓ Game is playable end-to-end in 1-player mode
✓ No console errors or crashes

---

## Implementation Notes

- **Input format compatibility**: AI `getInput()` must return same object shape as keyboard input handler to minimize coupling
- **Difficulty parameters**: Store in enum/constants for easy tweaking
- **Physics simulation**: No changes needed; AI just sends movement commands like a player would
- **Save preference**: Consider saving preferred difficulty to localStorage for next session
