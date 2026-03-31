---
version: 2.1
milestone: v2.1 Online Multiplayer Fix
created: 2026-03-31
phases: 2
---

# Dropfall v2.1 Roadmap: Online Multiplayer Fix

**Milestone Goal:** Fix broken online multiplayer so both players can control their own characters.

---

## Phase 1: Input Routing Fix

**Goal:** Fix the core bug where Player 2's inputs control Player 1's ball instead of their own.

**Status:** 📋 Planning

**Features:**
- [ ] **ONLINE-01**: Player 2 can control their blue ball when joining as client
- [ ] **ONLINE-02**: Player input mapped to assigned player slot, not hardcoded Player 1
- [ ] **ONLINE-03**: Server assigns player slot on client connect
- [ ] **ONLINE-04**: Client knows "I am player N" (stored in game state)
- [ ] **ONLINE-05**: Input handler reads assigned slot, routes to correct player
- [ ] **ONLINE-06**: Both players see red ball (Player 1) and blue ball (Player 2)
- [ ] **ONLINE-11**: Architecture supports 3+ player slots (design)
- [ ] **ONLINE-12**: Player colors assigned by slot number

**Root Cause Analysis:**
The code in `main.js` lines 248-261 shows proper slot-based routing:
- Slot 1 (host): `getPlayer1InputUnified` for player1, `opponentInput` for player2
- Slot 2 (client): `opponentInput` for player1, `getPlayer2InputUnified` for player2

But `getPlayer2InputUnified` calls `getPlayer2Input()` which reads `settings.controls.p2` (arrow keys), not Player 1 controls (WASD).

The user's requirement: "everyone uses Player 1 controls" from their local POV means both clients should use WASD, not arrow keys for Player 2.

**Fix Required:**
- Create a unified input getter that uses p1 controls regardless of which slot the client is
- OR modify online mode to always use p1 controls

**Plans:** 2-3

---

## Phase 2: Integration Testing

**Goal:** Verify both players can control their own balls end-to-end.

**Status:** 📋 Planning

**Features:**
- [ ] **ONLINE-08**: Server host can control red ball with Player 1 keys
- [ ] **ONLINE-09**: Client can control blue ball with Player 1 keys
- [ ] **ONLINE-10**: No regression in 1P/2P local modes
- [ ] End-to-end test with real network connection

**Plans:** 1-2

---

## Phase Dependencies

| Phase | Dependencies | Notes |
|-------|--------------|-------|
| 1 | None | Core bug fix |
| 2 | Phase 1 | Testing after fix |

---

## Key Technical Notes

**Current Behavior (BUG):**
1. Client joins, gets `playerSlot: 2`
2. `resetOnlineEntities()` assigns `getPlayer2InputUnified` to player2
3. `getPlayer2InputUnified` calls `getPlayer2Input()` which uses `controls.p2` (arrow keys)
4. Client presses WASD (p1 controls) → no effect
5. Client presses arrow keys → but player2 doesn't move because...

Wait, let me check the actual bug more carefully. The user said "Player 2 needs to be controlling their character with the player 1 controls". So perhaps the current code DOES use p1 controls but there's a different routing issue?

Let me re-read: "both clients see the game but it only works for player 1". So:
- Player 1 (host): works fine
- Player 2 (client): their inputs don't work at all

The code at line 253-257 shows:
- Slot 2: player2 gets `getPlayer2InputUnified`

And `getPlayer2InputUnified` returns `getPlayer2Input()` which uses p2 controls (arrow keys).

But the user wants BOTH to use p1 controls (WASD). So the fix is to use p1 controls for the local player regardless of slot.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Player 2 controls work | Both players can control their balls |
| Input uses p1 controls | WASD works for local player in online mode |
| No regression | 1P/2P local modes unchanged |
| Architecture ready | 3+ players supported in design |

---

*Created: 2026-03-31 at v2.1 milestone start*
