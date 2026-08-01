---
phase: 06-online-multiplayer-fix
reviewed: 2026-08-01T14:58:46Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/online.js
  - src/main.js
  - src/network/NetworkStateBuffer.js
  - server/game/GameRoom.js
  - server/game/Player.js
  - server/game/Arena.js
  - server/game/PhysicsWorld.js
  - server/server.js
  - shared/gameRules.js
  - shared/spawnPositions.js
  - tests/network-interpolation.test.ts
  - tests/multiplayer-room.test.ts
findings:
  critical: 9
  warning: 1
  info: 0
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-01T14:58:46Z  
**Depth:** deep  
**Files Reviewed:** 12  
**Status:** issues_found

## Summary

The focused multiplayer tests pass (30/30), the production client builds, and the five server-security tests pass when permitted to bind loopback. Those checks do not cover several reproducible lifecycle failures. Direct probes produced duplicate player slots, reconnected the wrong disconnected player, and caused Rapier to trap when two countdown starts overlapped. The client also lacks an authoritative pause/resync path and does not consume complete tile/full-state snapshots, so ordinary disconnects and opponent power-up pickups can leave peers in different worlds.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Concurrent countdown starts can corrupt Rapier state and crash the server

**Classification:** BLOCKER  
**Files:** `server/game/GameRoom.js:400-413`, `server/server.js:986-1015`  
**Issue:** `startCountdown()` leaves the room in `LOBBY` until after two awaited physics calls. Repeated `start_game` messages (or server-lobby auto-start racing a start request) therefore enter initialization concurrently. Both calls can create/overwrite the room world and reset bodies owned by the other world. A direct `Promise.all([room.startCountdown(), room.startCountdown()])` probe reproducibly ended in Rapier's `RuntimeError: unreachable`. Callers also discard the promise, so rejection can become an unhandled process-level failure.

**Fix:** Claim the transition synchronously and share one in-flight initialization promise; also catch failures at the message boundary.

```js
async startCountdown() {
    if (this.state !== 'LOBBY' || !this.areBothReady()) return false;
    this.state = 'COUNTDOWN'; // closes the re-entry window before await
    try {
        await this.initPhysics();
        this._resetRound();
        this._broadcastGameStarting(true);
        this._scheduleStartPlaying();
        return true;
    } catch (error) {
        this.state = 'LOBBY';
        throw error;
    }
}
```

Have `startGame()`/`maybeAutoStart()` await or `.catch()` this operation, and add a concurrent-start regression test.

### CR-02: Replacing a departed slot-1 player creates two slot-2 players

**Classification:** BLOCKER  
**File:** `server/game/GameRoom.js:125-147`  
**Issue:** Slot assignment is derived from `players.length`, not from the occupied slot numbers. If slot 1 leaves while slot 2 remains—a normal lobby leave or reconnect-grace expiry—the next joiner receives slot 2. A direct probe produced `slots: [2, 2]`. Both authoritative players then spawn on top of each other, `p1` disappears from snapshots, and client ownership/input mapping is invalid.

**Fix:** Allocate the actual free slot and reject the join if neither slot is available.

```js
const occupied = new Set(this.players.map(player => player.slot));
const slot = [1, 2].find(candidate => !occupied.has(candidate));
if (!slot) return null;
```

Add cases for slot 1 leaving both before a match and after reconnect grace expires.

### CR-03: A valid reconnect token can restore the wrong disconnected player

**Classification:** BLOCKER  
**Files:** `server/server.js:1117-1135`, `server/game/GameRoom.js:248-265`  
**Issue:** The server correctly finds the disconnected record whose token matched, but `GameRoom.reconnect(reconnectingId, ...)` ignores `reconnectingId` and independently selects the first disconnected player. When both players are disconnected, the second player's valid token can reconnect into slot 1. A direct probe requesting player `b` restored player `a` in slot 1. This is an authorization/identity violation and can also strand the rightful player.

**Fix:** Reconnect only the already-authenticated record (or exact id), and reject expired/mismatched records inside the room as defense in depth.

```js
reconnect(reconnectingId, newId, ws) {
    const playerInfo = this.players.find(player =>
        player.id === reconnectingId &&
        player.disconnected &&
        player.reconnectDeadline > Date.now()
    );
    if (!playerInfo) return null;
    // mutate this exact record only
}
```

### CR-04: The client declares reconnection successful before rejoin is authorized

**Classification:** BLOCKER  
**File:** `src/online.js:120-125,201-245,296-299`  
**Issue:** Socket `open` sends `rejoin_game`, immediately clears reconnect state, emits `reconnected`, and resolves the retry loop. Success is therefore based only on opening a WebSocket, not on receiving `rejoin_success`. If the room expired during backoff or the server returns `REJOIN_DENIED`, retries have already stopped; the client shows “Reconnected”, then remains stuck in its old match state on an unaffiliated socket. The generic error branch does not clear the room/token or return to the lobby.

**Fix:** Keep the attempt pending until `rejoin_success`; reject/retry (or return to lobby for a terminal denial) on the corresponding server error. Emit `reconnected` and clear `pendingRejoinGameId` only after the acknowledged rejoin.

### CR-05: Clients continue simulating while the authoritative room is paused for reconnect

**Classification:** BLOCKER  
**Files:** `server/game/GameRoom.js:150-168`, `src/online.js:586-597`, `src/main.js:2658-2692,2822-2826`  
**Issue:** On disconnect the server stops both simulation and snapshot loops. The remaining client only displays an overlay; its animation loop continues physics, player input, arena timers, and prediction while the server is frozen. During countdown it can even transition itself to `PLAYING` locally. After a reconnect, the peer can be seconds ahead and is snapped or dragged back by the first new snapshot. The disconnecting client has the same problem while retrying because `gameState` remains `PLAYING`.

**Fix:** Introduce an explicit online suspension state. While reconnecting or `opponentDisconnected`, stop local physics/countdown/input, send/hold neutral input, and resume only after an authoritative full-state acknowledgement. On resume, send full state to both peers before restarting room loops.

### CR-06: `full_state` is not a full resynchronization

**Classification:** BLOCKER  
**Files:** `server/game/GameRoom.js:689-711`, `src/main.js:2488-2507`  
**Issue:** The server sends game state, settings, scores, both poses, and tile state, but the client consumes only its local position/velocity. It ignores `gameState`, settings, scores, the remote pose, tiles, and the snapshot buffer. This endpoint is used immediately after reconnect and for explicit sync requests—the exact situations in which missed state must be repaired. A client can therefore rejoin with stale score/lifecycle/tile state and stale buffered opponent snapshots.

**Fix:** Include `tick`, boosts, and all lifecycle fields in the payload, then apply it atomically on the client: clear/seed the network buffer, snap both presentation states, replace scores/settings/tile state, and transition to the server's lifecycle state before resuming input.

### CR-07: Omitted NORMAL tiles leave stale bonuses and effects on other clients

**Classification:** BLOCKER  
**Files:** `server/game/Arena.js:185-198`, `src/main.js:2582-2595`  
**Issue:** `serializeTiles()` intentionally sends only non-normal tiles, but the client treats the list as deltas and updates only listed entries. When the opponent collects a bonus, the server changes that tile to `NORMAL` and omits it thereafter; the other client's remote player never runs pickup logic, so that client retains the `BONUS` forever. It may later grant its local predictor a power-up that does not exist on the server. The same assignment path also bypasses friction/statue transition hooks for ICE/BONUS states.

**Fix:** Treat each snapshot's `tileStates` as a complete authoritative sparse set: reset previously transient tiles absent from the set to NORMAL, then apply each transition through arena methods that update state, collider friction, visibility, and bonus visuals. Alternatively, send explicit sequenced tile deltas including NORMAL transitions.

### CR-08: Server movement ignores frozen and airborne control rules used by client prediction

**Classification:** BLOCKER  
**File:** `server/game/Player.js:75-135`  
**Issue:** The server decrements `frozenTimer` but applies movement impulses unconditionally, and it also allows steering after the player has fallen below the arena. The client predictor disables control while frozen or falling. A direct server-player probe with `frozenTimer = 1` still produced non-zero forward velocity after one update. Every ice encounter and fall therefore forces client/server divergence and reconciliation; the advertised freeze is not authoritative.

**Fix:** Compute the same `hasControl` predicate on both sides and gate boost start/drain and movement impulse with it.

```js
const hasControl = this.frozenTimer <= 0 && pos.y >= -1;
if (hasControl) {
    this.body.applyImpulse({ x: forceX, y: 0, z: forceZ }, true);
}
```

Add parity tests for frozen, airborne, boost-start, and boost-drain behavior.

### CR-09: Network-info response data is inserted as executable HTML

**Classification:** BLOCKER  
**File:** `src/main.js:1156-1178`  
**Issue:** The user can connect to an arbitrary server URL, and `setupLanDetection()` trusts that server's `/api/network-info` JSON. `suggested.address` and `info.port` are interpolated into `lanInfo.innerHTML`, allowing a malicious server response to execute script in the game origin. This is DOM XSS reachable through the normal online-connect flow.

**Fix:** Validate the address/port and construct the suggestion with DOM nodes and `textContent`; never interpolate remote values into `innerHTML`.

## Warnings

### WR-01: A sustained latency increase starves interpolation for the entire offset window

**Classification:** WARNING  
**File:** `src/network/NetworkStateBuffer.js:133-188`  
**Issue:** Offset-resync detection compares `clockOffsetMs` with the minimum of a five-second sample window. When transit time rises (for example 100 ms to 500 ms), the old 100 ms minimum keeps the comparison below the resync threshold until it ages out. A 4-second, 30 Hz probe left `clockOffsetMs` at 100 ms, drove adaptive delay to about 240 ms, and sampled in `extrapolated` mode continuously. The new confirmation mechanism therefore handles lower offsets quickly but not higher offsets, producing several seconds of snapshot-cadence motion after a route change or wake.

**Fix:** Detect sustained shifts from consecutive raw offset samples independently of the old window minimum (in both directions), then replace the old window after confirmation. Add a regression test for a persistent positive offset shift and assert that sampling returns to interpolation promptly.

---

_Reviewed: 2026-08-01T14:58:46Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
