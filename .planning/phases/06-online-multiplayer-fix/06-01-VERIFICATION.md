# Phase 1 Complete: Online Multiplayer Input Routing Fix

## Summary

Fixed the core bug where Player 2 (client) could not control their blue ball in online multiplayer.

## Root Cause

In `src/main.js`:
- Line 257: Player 2 was using `getPlayer2InputUnified` which maps to arrow keys
- This caused client inputs to control the wrong ball (Player 1 instead of Player 2)

## Changes Made

### 1. resetOnlineEntities() - Lines 253-257

**Before:**
```javascript
} else if (mySlot === 2) {
    player1 = new Player('player1', 0xff4444, hostPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    player2 = new Player('player2', 0x4444ff, clientPos, getPlayer2InputUnified);  // BUG: arrow keys
}
```

**After:**
```javascript
} else if (mySlot === 2) {
    // I'm the client (player 2) on the right - but I use WASD (Player 1 controls)
    player1 = new Player('player1', 0xff4444, hostPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    player2 = new Player('player2', 0x4444ff, clientPos, getPlayer1InputUnified);  // FIX: WASD
}
```

### 2. Online Input Sync - Line 1019

**Before:**
```javascript
const input = (state.online.playerSlot === 1 ? getPlayer1InputUnified : getPlayer2InputUnified)();
```

**After:**
```javascript
// Always use Player 1 controls (WASD) in online mode regardless of slot
const input = getPlayer1InputUnified();
```

## Verification

- All 233 existing tests pass ✓
- Manual browser verification required (start two windows, host+join)

## Files Modified

- `src/main.js` - 2 locations (lines ~257 and ~1019)