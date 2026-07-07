---
milestone: v3.0
name: Release Readiness
phases: 4
created: 2026-07-07
---

# Dropfall v3.0 Roadmap: Release Readiness

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 8 | Deployment Foundation | Make the project deployable to railway.app with environment-aware config. | DEP-01..05, CFG-01..04 | 5 |
| 9 | Local UX & Release Polish | Preserve local play and knock out release blockers. | LOCAL-01..03, POLISH-01..05 | 5 |
| 10 | Authoritative Server | Build a hosted server that runs physics and owns match state. | ONLINE-S-01..05 | 5 |
| 11 | Online Client Integration | Wire client to authoritative server with prediction/reconciliation. | ONLINE-C-01..05 | 5 |

**Total:** 4 phases | 20 requirements mapped | 20 success criteria

---

## Phase 8: Deployment Foundation

**Goal:** Make the project deployable to railway.app with environment-aware config.

**Requirements:** DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, CFG-01, CFG-02, CFG-03, CFG-04

**Success Criteria:**
1. `npm ci && npm run build` completes without errors.
2. `railway.json` (or Dockerfile + service config) defines both static client and server services.
3. Server reads `PORT` and CORS origins from environment variables.
4. Client uses `import.meta.env.VITE_SERVER_URL` (or equivalent) instead of hardcoded `localhost:3000`.
5. Level editor API URL is environment-driven and works in deployed builds.

**Deliverables:**
- `railway.json`
- Updated `package.json` scripts
- Environment variable documentation
- Working health-check endpoint (`/health`)

---

## Phase 9: Local UX & Release Polish

**Goal:** Preserve local play and knock out release blockers.

**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05

**Success Criteria:**
1. Local 2-player classic mode plays through a full match without regression.
2. Single-player race mode plays through a full race without regression.
3. Power-up notifications are repositioned so they do not obscure the arena.
4. Arena size slider caps at 16 and destruction-rate slider maps low→little, high→much destruction.
5. Settings presets can be saved, loaded, and deleted; auto-restart preference persists.

**Deliverables:**
- UI/UX fixes in `src/main.js` and `src/style.css`
- Settings preset system
- Regression tests for local modes

---

## Phase 10: Authoritative Server

**Goal:** Build a hosted server that runs physics and owns match state.

**Requirements:** ONLINE-S-01, ONLINE-S-02, ONLINE-S-03, ONLINE-S-04, ONLINE-S-05

**Success Criteria:**
1. Server imports Rapier3D and initializes a physics world identical to the client.
2. Server advances simulation at a fixed tick rate (e.g., 60 Hz) and accepts player inputs.
3. Server broadcasts serialized game state (player positions, velocities, tile states, scores) to both clients at 20 Hz.
4. Lobby lifecycle works: create, join, ready-up, countdown, play, round-over, rematch.
5. Disconnect grace window (15s) allows reconnect without ending the match.

**Deliverables:**
- New `server/game/` modules: `GameRoom.js`, `PhysicsWorld.js`, `Player.js`, `Arena.js`
- Updated `server/server.js` to route WebSocket messages to game rooms
- Shared serialization format between server and client

---

## Phase 11: Online Client Integration

**Goal:** Wire client to authoritative server with prediction/reconciliation.

**Requirements:** ONLINE-C-01, ONLINE-C-02, ONLINE-C-03, ONLINE-C-04, ONLINE-C-05

**Success Criteria:**
1. Client sends input frames to server every local tick.
2. Client applies authoritative state and interpolates remote player smoothly.
3. Local player uses client-side prediction; server corrections are reconciled without jarring snaps.
4. Lobby UI supports same-origin auto-connect, manual URL entry, create/join, ready-up, and error messages.
5. Connection status, opponent presence, disconnect/reconnect, and round results are clearly shown.

**Deliverables:**
- Refactored `src/online.js` or new `src/network/` modules
- Updated `src/main.js` online hooks
- New/updated lobby UI components

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-01 | 8 | Complete |
| DEP-02 | 8 | Complete |
| DEP-03 | 8 | Complete |
| DEP-04 | 8 | Complete |
| DEP-05 | 8 | Complete |
| CFG-01 | 8 | Complete |
| CFG-02 | 8 | Complete |
| CFG-03 | 8 | Complete |
| CFG-04 | 8 | Complete |
| LOCAL-01 | 9 | Complete |
| LOCAL-02 | 9 | Complete |
| LOCAL-03 | 9 | Complete |
| POLISH-01 | 9 | Complete |
| POLISH-02 | 9 | Complete |
| POLISH-03 | 9 | Complete |
| POLISH-04 | 9 | Complete |
| POLISH-05 | 9 | Pending |
| ONLINE-S-01 | 10 | Pending |
| ONLINE-S-02 | 10 | Pending |
| ONLINE-S-03 | 10 | Pending |
| ONLINE-S-04 | 10 | Pending |
| ONLINE-S-05 | 10 | Pending |
| ONLINE-C-01 | 11 | Pending |
| ONLINE-C-02 | 11 | Pending |
| ONLINE-C-03 | 11 | Pending |
| ONLINE-C-04 | 11 | Pending |
| ONLINE-C-05 | 11 | Pending |

**Coverage:** 28 requirements mapped to 4 phases | Unmapped: 0 ✓

---
*Roadmap created: 2026-07-07*
*Last updated: 2026-07-07 after Phase 9 completion*
