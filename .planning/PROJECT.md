---
name: Dropfall TypeScript Migration & Architecture Refactor
version: v2.0
type: brownfield
created: 2026-03-30
updated: 2026-03-30
---

# Dropfall v2.0: TypeScript Migration & Architecture Refactor

## What This Is

A comprehensive refactoring of the Dropfall game engine from JavaScript to TypeScript with modern architecture, improved maintainability, and structural foundation for scaling to multiplayer, multiple arenas, and new game modes.

**Current state:** Working 1P/2P game with AI, single arena. Fragile codebase with isolated issues (audio glitches, jank).

**Desired state:** Production-grade game engine with strong type safety, isolated systems, clear data flows, comprehensive tests, and modular architecture ready for: multiplayer synchronization, additional stages/arenas, public arena mode (3+ players).

## Core Value

By establishing clean architecture and type safety upfront, we:
- **Eliminate cascading failures** — Fix one issue without breaking another
- **Enable faster feature development** — New stages, multiplayer, and arena modes ship reliably
- **Improve AI maintainability** — Type-safe AI controller handling
- **Create debugging clarity** — Isolated systems with predictable data flows

## Key Constraints

- **No breaking changes to gameplay** — 1P/2P modes remain feature-complete during refactor
- **Incremental migration** — Old JS files coexist with new TS during transition
- **No feature additions during refactor** — Focus is structure, not new capabilities
- **Performance baseline** — Must not regress from current load times or frame rate
- **Test-driven migration** — Each system migrated with tests to prevent regression

## Context

### Existing Architecture (JS)

| Layer | Current | Issues |
|-------|---------|--------|
| **Input** | input.js | Mixed keyboard/gamepad, no types, coupling to AI/Player |
| **Physics** | physics.js | Raw Rapier3D, no entity abstraction |
| **Rendering** | renderer.js + Three.js | Scene queries scattered, camera logic unclear |
| **State** | store.js (Zustand) | Good foundation, needs validation layers |
| **Entities** | Player.js, Arena.js, effects systems | No base class, duplicated lifecycle logic |
| **AI** | AIController.js | New, good isolation, no tests |
| **Audio** | audio.js | Suspected race conditions, no lifecycle management |
| **Multiplayer** | online.js | Naive WebSocket, no protocol versioning |
| **Build** | Vite + manual chunks | Optimization exists, can be improved |

### Market Analysis

TypeScript 3D game engines:
- **Babylon.js** — More extensive than Three.js, steeper learning curve
- **Threepipe** — Three.js wrapper, adds some structure, overkill for our scope
- **Three.js + custom architecture** — Our current path, proven in shipping games
- **Unreal/Godot** — Wrong scale for web-based game

**Decision:** Stay with Three.js + Rapier3D + custom architecture. Add structure via:
- Entity base class with lifecycle hooks
- System architectural pattern (update, render, serialize)
- Handler/Event pattern for loose coupling
- Type guards and narrowing for state mutations

### Dependencies Review

| Dependency | Version | Role | Assessment |
|------------|---------|------|------------|
| **three** | 0.183.1 | 3D rendering | Keep — stable, actively maintained |
| **@dimforge/rapier3d-compat** | 0.19.3 | Physics | Keep — mature, performant, compat mode stable |
| **zustand** | 5.0.11 | State management | Keep — minimal, fast, type-safe |
| **ws** | 8.18.0 | WebSocket | Keep — solid, but add protocol layer |
| **vite** | 7.3.1 | Build tool | Keep — fast, good chunk splitting |
| **vitest** | 4.1.0 | Testing | Keep — fast, well-integrated |
| **(new) ts-node** | ~11 | TypeScript execution | Add — dev tooling |
| **(new) zod** | ~3.x | Validation | Add — schema validation for network messages, store mutations |

### Technology Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| TypeScript strict mode | Catch type errors at build time, improve IDE support | ✓ Approved |
| Entity-System pattern for game objects | Replace ad-hoc lifecycle logic with formal abstraction | ✓ Approved |
| Handler/Event pattern for decoupling | Input → Handlers, Physics → Events, eliminates circular deps | ✓ Approved |
| Zod for runtime validation | Catch malformed network/store data before state mutation | ✓ Approved |
| Module-level exports over singleton classes | Simplifies imports, tree-shaking friendly | ✓ Approved |
| Vitest for unit + integration tests | Speed, Vite integration, strong DX | ✓ Approved |
| Incremental migration strategy | Coexist TS + JS during transition, reduces all-or-nothing risk | ✓ Approved |

## Out of Scope

- Bug fixes during refactor (e.g., audio race conditions) — Addressed after structure is in place
- Audio system from scratch — Refactor existing `audio.js` into `AudioSystem` with lifecycle
- UI redesign — Keep current UI, improve underlying data binding
- New game modes or stages — Prerequisite is clean architecture
- Performance optimization (beyond structural improvements) — Separate phase post-refactor
- Mobile/Touch controls — Beyond current scope, addressed after multiplayer

## Why This Matters

The current codebase is **fragile** — AI changes can break menu navigation, physics fixes introduce jank, audio initialization has race conditions. This indicates:

1. **Tight coupling** — Systems depend on each other's internal state
2. **Implicit contracts** — Expected initialization order, data shapes not enforced
3. **Lifecycle ambiguity** — Unclear when entities are created, destroyed, reset
4. **Type uncertainty** — Cascading `any` types hide bugs until runtime

Refactoring establishes:
- **Explicit types** — All data flows typed, no `any`
- **Lifecycle clarity** — Entity state machine with hooks (init → ready → destroy)
- **Loose coupling** — Events/Handlers decouple systems
- **Test coverage** — Unit tests for each system, integration tests for flows

## Success Criteria

- ✓ 100% TypeScript coverage (strict mode) — all `.js` → `.ts`
- ✓ Test coverage ≥80% on core systems (Input, Physics, State, Entities)
- ✓ All menu flows work end-to-end (GAME_MODE_SELECT → play → game over → menu)
- ✓ 1P and 2P modes functionally identical to current state
- ✓ No performance regression (load time, frame rate ≥ current baseline)
- ✓ AI controller tests with 3 difficulty levels verified
- ✓ Type guards prevent runtime data shape violations
- ✓ New contributor can understand data flow in <30min (via docs + types)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After milestone completion** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Success criteria audit — all met?
3. Measurement of type safety/test coverage improvements
4. Assessment of architecture clarity for future features

---
*Last updated: 2026-03-30 at project initialization*
