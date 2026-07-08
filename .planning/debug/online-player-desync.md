---
gsd_debug_version: 1.0
status: resolved
slug: online-player-desync
trigger: >
  the online player is a bit broken, but lots of it works brilliantly. From player twos screen i can see player ones movement perfectly and if player 2 collides with player 1 then player one is moved, but player 2 doesn't move on player 1s screen at all, and they the levels dont look the same, the detroyed tiles dont match, and the players relative positions on level is also different
created: "2026-07-07"
updated: "2026-07-07T15:03+10"
---

# Debug Session: Online Player Desync

## Symptoms

- **Expected behavior:** Both clients in an online match should display both players moving, the same destroyed tiles, and consistent relative player positions on the arena.
- **Actual behavior:**
  - From Player 2's screen, Player 1's movement appears perfectly.
  - When Player 2 collides with Player 1, Player 1 is pushed/moved on Player 2's screen.
  - Player 2 does **not** move on Player 1's screen at all.
  - Destroyed tiles do not match between the two screens.
  - Players' relative positions on the level differ between screens.
- **Error messages:** No console errors or warnings reported in either browser.
- **Timeline / context:** Issue observed after completing Phase 11 (authoritative server + client prediction/reconciliation). Both players tested with same browser/OS setup.
- **Reproduction:** Start an online game with two clients. Move Player 2 around and collide with Player 1. Observe that Player 2 is invisible/static on Player 1's screen while Player 1 is visible and reactive on Player 2's screen. Destroyed tiles also diverge.

## Current Focus

- **hypothesis:** The authoritative server is broadcasting both players and tile states correctly, but the host client is not consuming them. The host skips remote-player interpolation and still runs local arena tile logic, while the client (Player 2) correctly applies server state.
- **test:** Verify `src/main.js` gates `applyOnlineClientRemoteInterpolation` and `arena.update({ isOnlineClient: true })` behind `!state.online.isHost`, and confirm the server never sends `opponent_input` messages.
- **expecting:** Removing the host-only exceptions makes both clients display server-authoritative remote players and tile states.
- **next_action:** Apply minimal fix in `src/main.js` and run tests/build.
- **reasoning_checkpoint:**
  - Server `GameRoom._broadcastState()` sends `p1Pos/p1Vel/p2Pos/p2Vel` and `tileStates` to every peer.
  - `src/main.js` handles these in the `gameUpdate` listener and updates `remotePlayerTargetPosition`.
  - However, the actual interpolation of the remote kinematic body is gated by `isOnlineClient` (`!isHost`), so the host never moves the remote player.
  - Host arena update is also gated the same way, so the host runs its own tile-destruction timers that diverge from the server's.
  - Server `handlePlayerInput` does not forward `opponent_input`, so the host's fallback input-driven remote player also cannot move.

## Evidence

- **timestamp: 2026-07-07T15:01+10**
  - File: `server/game/GameRoom.js:335-355`
  - Observation: `_broadcastState()` emits `p1Pos`, `p1Vel`, `p2Pos`, `p2Vel`, and `tileStates` from the authoritative simulation to both connected players.
- **timestamp: 2026-07-07T15:02+10**
  - File: `src/main.js:1838-1842`
  - Observation: `isOnlineClient` is `state.gameMode === 'ONLINE' && !state.online.isHost`. Remote interpolation `applyOnlineClientRemoteInterpolation(state)` only runs when `isOnlineClient` is true, excluding the host.
- **timestamp: 2026-07-07T15:03+10**
  - File: `src/main.js:1860-1864`
  - Observation: `arena.update(delta, { isOnlineClient: true })` is also gated by `isOnlineClient`, so the host runs full local tile triggering instead of only applying server tile states.
- **timestamp: 2026-07-07T15:04+10**
  - File: `server/server.js:600-603`
  - Observation: `handleGameState` is empty; host-sent `game_state` messages are ignored. More importantly, `handlePlayerInput` sets input on the server but never broadcasts `opponent_input` to the other client.
- **timestamp: 2026-07-07T15:05+10**
  - File: `src/main.js:888-891`
  - Observation: Both host and client set the remote player's rigid body to `KinematicPositionBased`, but only the non-host actually calls `setNextKinematicTranslation` each frame.

## Eliminated

- **Server not sending both players:** Confirmed both `p1Pos/p1Vel` and `p2Pos/p2Vel` are in the broadcast payload.
- **Client ignoring remote player data:** Non-host client applies remote data correctly; host is the one skipping it.
- **Tile events not serialized:** `ServerArena.serializeTiles()` sends all non-NORMAL/non-FALLEN tile states; client applies them.

## Resolution

- **root_cause:** The host client was treated differently from the joining client in `src/main.js`. Remote-player interpolation (`applyOnlineClientRemoteInterpolation`) and the server-authoritative arena update path (`arena.update(delta, { isOnlineClient: true })`) were gated by `isOnlineClient` (`!state.online.isHost`). Because the server already runs the authoritative simulation and broadcasts both player transforms and tile states, the host never applied the remote player's position to its kinematic body, and it ran independent local tile-destruction logic that diverged from the server.
- **fix:** Changed the two gates from `isOnlineClient` to `isOnlineMatch` (`state.gameMode === 'ONLINE'`) so both host and joining client interpolate the remote player from server state and apply server-authoritative tile states only. The `isOnlineClient` variable is retained for collision-detection behavior.
- **verification:** `npm run test` passes 233 tests. `npm run build` succeeds.
- **files_changed:** `src/main.js`
