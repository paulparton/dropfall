---
name: Dropfall Release Readiness
version: v3.0
type: brownfield
created: 2026-03-31
updated: 2026-07-07
---

# Dropfall v3.0: Release Readiness

## What This Is

Dropfall is a fast-paced, retro-styled 3D local and online multiplayer arena game built with Three.js and Rapier3D. Players battle in a cyber arena, use boosts, and knock opponents off the edge. This milestone prepares the game for public web release with first-class online multiplayer and railway.app deployment.

## Core Value

Players can reliably play Dropfall together online or locally in a smooth, responsive, and visually polished experience.

## Business Context

- **Customer**: Casual multiplayer gamers on web/desktop/mobile web.
- **Revenue model**: Free web release; future monetization optional.
- **Success metric**: Stable online matches with <100ms perceived latency; successful railway deployment of client + server.
- **Strategy notes**: Ship a solid web MVP before considering native app stores or advanced features.

## Requirements

### Validated

- ✓ Local split-screen 2-player classic mode — existing
- ✓ Ball physics, arena, tile destruction, power-ups — existing
- ✓ Settings/customization (colors, hats, sphere params) — existing
- ✓ Single-player race mode — existing
- ✓ Basic WebSocket lobby + matchmaking — existing (to be replaced)
- ✓ VR/AR headset support — existing

### Active

- [ ] Rebuild online multiplayer with authoritative hosted game server.
- [ ] Deploy static client and game server to railway.app from GitHub.
- [ ] Fix hardcoded environment dependencies (level API URL, WebSocket URL).
- [ ] Ensure local multiplayer UX remains smooth and unchanged.
- [ ] Polish release blockers: performance, UI clutter, settings UX.
- [ ] Add production build, health checks, and startup resilience.

### Out of Scope

- Native mobile app packaging (PWA/capacitor) — future scope.
- Advanced matchmaking/ranked play — future scope.
- Cross-platform console ports — future scope.
- Mobile-specific game modes — deferred; existing mobile UX work from v2.3 may be incorporated if low-risk.

## Context

- Previous milestone v2.3 focused on first-class mobile support. While some responsive/touch work may land here, v3.0 prioritizes release readiness and online multiplayer.
- Current online multiplayer uses a host-client relay model: player 1 (host) runs full physics and broadcasts `game_state`; player 2 interpolates. This causes desync, input lag, and host-disconnect failures.
- The level editor API is hardcoded to `http://localhost:3001/api`, which breaks any non-local deployment.
- No Dockerfile, railway.json, or environment-based configuration exists yet.
- The GitHub repo is already connected to a railway.app account.

## Constraints

- **Tech stack**: Must stay on Three.js + Rapier3D + Vite + Node.js + WebSocket.
- **Budget**: Use railway.app free/ starter tier; avoid managed databases if possible (in-memory state acceptable for MVP).
- **Compatibility**: Keep existing local-multiplayer and single-player modes working.
- **Performance**: Maintain 60 FPS on desktop, 30 FPS minimum on mid-range mobile.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Authoritative server physics | Eliminates host advantage, desync, and host-disconnect failures. | — Pending |
| Deploy client + server on railway.app | User already connected the repo; simplest path to public release. | — Pending |
| Replace rather than patch online code | Current relay model is fundamentally unreliable; cleaner to rebuild. | — Pending |
| Keep local multiplayer unchanged | It already works; scope risk is online + deployment. | — Pending |

## Current Milestone: v3.0 Release Readiness

**Goal:** Ship Dropfall as a playable web release with first-class online multiplayer and railway.app deployment.

**Target features:**
- Authoritative online multiplayer with hosted game server.
- railway.app deployment for static client and WebSocket server.
- Environment-aware configuration (no hardcoded localhost).
- Local + online multiplayer UX validation.
- Release blocker fixes (performance, UI, settings).

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason.
2. Requirements validated? → Move to Validated with phase reference.
3. New requirements emerged? → Add to Active.
4. Decisions to log? → Add to Key Decisions.
5. "What This Is" still accurate? → Update if drifted.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections.
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-07-07 after milestone v3.0 initialization*
