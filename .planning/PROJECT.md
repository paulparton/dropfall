---
name: Dropfall Online Multiplayer Fix
version: v2.1
type: brownfield
created: 2026-03-31
updated: 2026-03-31
---

# Dropfall v2.1: Online Multiplayer Fix

## What This Is

Fix the broken online multiplayer so both players can control their own characters. Currently clients connect and see each other, but Player 2's inputs control Player 1's ball instead of their own.

## Problem Statement

- Server starts, clients connect successfully
- Both players see the game rendered (red ball, blue ball with names)
- **BUG:** When Player 2 presses movement keys, the RED ball (Player 1) moves instead of their BLUE ball
- From each client's local POV, they're "player 1" - but this isn't properly routed

## Core Value

Enable real 2-player online gameplay where:
- Server host = Player 1 (red ball) - controls with Player 1 keys
- Client joins = assigned Player 2 (blue ball) - controls with Player 1 keys on their computer
- Each player only controls THEIR ball, not all balls
- Scalable for future 3+ player support

## Target Features

1. **Player Input Routing Fix** - Map local key presses to assigned player slot
2. **Player Slot Assignment** - Server assigns slot on connect, client knows "I am player N"
3. **Visual Player Identification** - Names above balls already working
4. **2-Player Online Test** - Both players can control their own balls end-to-end
5. **Scalable Architecture** - Design supports 3+ players (green ball, etc.)

## Key Context

From earlier discussion:
- Server works, clients connect, both see the game
- Each client locally uses "Player 1 controls" - this is correct
- Bug: The inputs are being applied to Player 1's ball globally, not the local player's ball
- Need to track which slot the local client is assigned, and route inputs to that slot

## Out of Scope

- 3+ player support (design for it, but implement 2-player only)
- New game modes or arenas
- Performance optimization
- UI redesign

## Success Criteria

- [ ] Player 2 can control their blue ball with Player 1 keys
- [ ] Player 1 can control their red ball on server
- [ ] Both players see each other's balls with names
- [ ] Architecture supports 3+ players (ready for future)
- [ ] No regression in 1P/2P local modes

---

## Evolution

This document evolves at milestone boundaries.

**After each phase transition:**
1. Requirements validated? → Move to Verified
2. New requirements emerged? → Add to Active
3. Key decisions to log → Add to Key Decisions

**After milestone completion:**
1. Full review of all sections
2. Success criteria audit
3. Prepare for next milestone (v2.2 or v3.0)

---

*Last updated: 2026-03-31 at v2.1 milestone start*
