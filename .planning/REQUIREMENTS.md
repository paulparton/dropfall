---
milestone: v3.0
created: 2026-07-07
---

# Dropfall v3.0 Requirements: Release Readiness

## Milestone v3.0 Requirements

### Deployment (DEP)

- [ ] **DEP-01**: Static game client builds and deploys to railway.app (or associated static hosting).
- [ ] **DEP-02**: WebSocket game server deploys to railway.app as a service.
- [ ] **DEP-03**: railway.app config is stored in repo (railway.json or Dockerfile + environment variables).
- [ ] **DEP-04**: Production build script runs cleanly (`npm ci && npm run build`).
- [ ] **DEP-05**: Server exposes a health-check endpoint for railway probes.

### Online Multiplayer — Server (ONLINE-S)

- [ ] **ONLINE-S-01**: Server runs an authoritative Rapier3D physics simulation for online matches.
- [ ] **ONLINE-S-02**: Server accepts player inputs, advances simulation, and broadcasts authoritative game state.
- [ ] **ONLINE-S-03**: Server supports lobby creation, joining, ready-up, countdown, and match lifecycle.
- [ ] **ONLINE-S-04**: Server handles player disconnect/reconnect with a grace window.
- [ ] **ONLINE-S-05**: Server validates game settings and enforces consistent match parameters.

### Online Multiplayer — Client (ONLINE-C)

- [ ] **ONLINE-C-01**: Client sends local input to server every frame/tick.
- [ ] **ONLINE-C-02**: Client receives authoritative state and updates remote + local entities smoothly.
- [ ] **ONLINE-C-03**: Client implements prediction and reconciliation so local controls feel responsive.
- [ ] **ONLINE-C-04**: Lobby UI allows entering server URL (or auto-detects same-origin), creating/joining games, and ready-up.
- [ ] **ONLINE-C-05**: Connection status, opponent presence, and errors are clearly communicated in UI.

### Configuration (CFG)

- [ ] **CFG-01**: WebSocket server URL is environment-driven, not hardcoded.
- [ ] **CFG-02**: Level editor API URL is environment-driven, not hardcoded to `localhost:3001`.
- [ ] **CFG-03**: Client build injects environment variables correctly for dev/staging/prod.
- [ ] **CFG-04**: Server port and CORS origins are configurable via environment variables.

### Local Multiplayer UX (LOCAL)

- [ ] **LOCAL-01**: Local 2-player split-screen/classic mode still works without regression.
- [ ] **LOCAL-02**: Single-player race mode still works without regression.
- [ ] **LOCAL-03**: Input bindings and menu navigation remain unchanged for desktop.

### Release Polish (POLISH)

- [ ] **POLISH-01**: Power-up notifications no longer block player view.
- [ ] **POLISH-02**: Arena size slider is capped at 16 and destruction-rate slider direction is fixed.
- [ ] **POLISH-03**: Settings can be saved/loaded as presets.
- [ ] **POLISH-04**: Auto-restart preference persists across matches (local storage).
- [ ] **POLISH-05**: Game maintains target frame rates on desktop and mid-range mobile.

## Future Requirements (v3.1+)

### Advanced Online Features (deferred)

- **ONLINE-F-01**: Spectator mode.
- **ONLINE-F-02**: Ranked matchmaking.
- **ONLINE-F-03**: Replay recording.
- **ONLINE-F-04**: Region selection / multiple server regions.

### Mobile & PWA (deferred)

- **MOBILE-F-01**: PWA support (Add to Home Screen).
- **MOBILE-F-02**: Advanced haptic feedback.
- **MOBILE-F-03**: Native wrapper (Capacitor/Cordova).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app packaging | PWA/native wrapper is future scope |
| Ranked matchmaking | Out of scope for initial release |
| Console ports | Web-first release |
| Mobile-specific game modes | Classic/Race modes only for v3.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-01 | Phase 8 | Pending |
| DEP-02 | Phase 8 | Pending |
| DEP-03 | Phase 8 | Pending |
| DEP-04 | Phase 8 | Pending |
| DEP-05 | Phase 8 | Pending |
| CFG-01 | Phase 8 | Pending |
| CFG-02 | Phase 8 | Pending |
| CFG-03 | Phase 8 | Pending |
| CFG-04 | Phase 8 | Pending |
| LOCAL-01 | Phase 9 | Pending |
| LOCAL-02 | Phase 9 | Pending |
| LOCAL-03 | Phase 9 | Pending |
| POLISH-01 | Phase 9 | Pending |
| POLISH-02 | Phase 9 | Pending |
| POLISH-03 | Phase 9 | Pending |
| POLISH-04 | Phase 9 | Pending |
| POLISH-05 | Phase 9 | Pending |
| ONLINE-S-01 | Phase 10 | Pending |
| ONLINE-S-02 | Phase 10 | Pending |
| ONLINE-S-03 | Phase 10 | Pending |
| ONLINE-S-04 | Phase 10 | Pending |
| ONLINE-S-05 | Phase 10 | Pending |
| ONLINE-C-01 | Phase 11 | Pending |
| ONLINE-C-02 | Phase 11 | Pending |
| ONLINE-C-03 | Phase 11 | Pending |
| ONLINE-C-04 | Phase 11 | Pending |
| ONLINE-C-05 | Phase 11 | Pending |

**Coverage:**
- v3.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after milestone v3.0 initialization*
