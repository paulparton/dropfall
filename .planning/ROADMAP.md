---
version: 2.0
milestone: v2.0 TypeScript Migration
created: 2026-03-30
phases: 6
---

# Dropfall v2.0 Roadmap

**Milestone Goal:** Establish clean, type-safe architecture foundation for Dropfall to support future multiplayer, multi-arena, and game mode expansion.

---

## Phase 1: TypeScript Foundation & Build Pipeline

**Goal:** Set up TypeScript strict mode, configure build tooling for TS, migrate `package.json` and build config.

**Features:**
- ✓ TypeScript 5.x strict mode configuration
- ✓ Build pipeline (tsc + Vite) with incremental compilation
- ✓ Source maps for debugging
- ✓ Type declaration files for Three.js, Rapier3D, WebSocket
- ✓ ESLint + TypeScript plugin for static analysis

**Acceptance:**
- `npm run build` builds successfully with 0 TS errors (strict mode)
- Dev server works with hot reload (no JS needed)
- Type checking passes on current JS (via allowJs temporarily)
- No performance regression in bundle size

**Estimated Plans:** 3-4

---

## Phase 2: Core Type System & State Management

**Goal:** Define comprehensive TypeScript types for all game domains. Migrate Zustand store to typed interface. Set up Zod schemas for validation.

**Features:**
- ✓ `types/Game.ts` — Game state, entity types, lifecycle
- ✓ `types/Input.ts` — Input payloads, handlers, sources
- ✓ `types/Physics.ts` — Bodies, collisions, forces, events
- ✓ `types/Audio.ts` — Sound effects, music, lifecycle
- ✓ `types/Network.ts` — Message protocol, versioning
- ✓ `store.ts` refactor — Typed Zustand store with validation schemas
- ✓ `types/Entity.ts` — Base entity interface, lifecycle hooks

**Acceptance:**
- All types exported and importable
- Store mutations typed and validated with Zod
- No `any` types in type files
- Tests pass for store + validation

**Estimated Plans:** 3-4

---

## Phase 3: Audio System Refactor

**Goal:** Extract audio logic into `AudioSystem` class with explicit lifecycle. Add initialization on first input. Remove suspected race conditions.

**Features:**
- ✓ `systems/AudioSystem.ts` — Initialize, play, stop, dispose
- ✓ Lifecycle hooks — On input init, on game start, on round end
- ✓ Audio validation schema — Prevent invalid playback calls
- ✓ Memory cleanup — Proper unload of buffers, listeners
- ✓ State machine — Uninitialized → Ready → Playing → Disposed
- ✓ Tests for lifecycle, race conditions, cleanup

**Acceptance:**
- Audio plays reliably after first input
- No race conditions in initialization
- Music persists correctly through multiple rounds
- No memory leaks (verified with tests)

**Estimated Plans:** 3-4

---

## Phase 4: Physics & Input Systems

**Goal:** Extract physics queries into typed event system. Create input handler pattern decopling keyboard/gamepad/AI from Player.

**Features:**
- ✓ `systems/PhysicsSystem.ts` — Collision detection, events
- ✓ `handlers/InputHandler.ts` — Unified input source (keyboard, gamepad, AI)
- ✓ Physics event types — Collision, knockback, out-of-bounds
- ✓ Input validation schemas — Ensure payload shape
- ✓ Tests for input combinations, physics events

**Acceptance:**
- Physics queries replaced with events
- AI/keyboard/gamepad input normalized to single handler
- AI controller still functions with 3 difficulty levels
- Input + Physics tests pass with ≥80% coverage

**Estimated Plans:** 4-5

---

## Phase 5: Entity System & Game Loop

**Goal:** Create Entity base class and lifecycle hooks. Migrate Player/Arena/Effects to typed entities. Integrate all systems into main game loop.

**Features:**
- ✓ `entities/Entity.base.ts` — Base class with lifecycle
- ✓ `entities/Player.ts` — Typed player class, hooks
- ✓ `entities/Arena.ts` — Typed arena entity
- ✓ `entities/ParticleSystem.ts`, `LightningSystem.ts`, `ShockwaveSystem.ts` — Typed effect entities
- ✓ `main.ts` refactor — Integrate entity lifecycle, systems, handlers
- ✓ Game loop integration tests — Full 1P/2P gameplay flows

**Acceptance:**
- All entities inherit from base class
- Entity lifecycle (init → ready → destroy) works without data leaks
- 1P and 2P modes play end-to-end
- Game loop tests cover state transitions

**Estimated Plans:** 5-6

---

## Phase 6: Testing & Documentation

**Goal:** Achieve ≥80% test coverage on core systems. Document architecture for new contributors. Cleanup old JS files.

**Features:**
- ✓ Unit tests for all systems (Input, Physics, Audio, State)
- ✓ Integration tests for 1P/2P/AI gameplay flows
- ✓ Memory leak tests (entity cleanup, event listener removal)
- ✓ Architecture documentation — System overview, patterns, lifecycle
- ✓ Testing guide — How to test new systems
- ✓ Remove old `.js` files, finalize `.ts` migration

**Acceptance:**
- Coverage report ≥80% on core systems
- All critical paths (1P/2P/AI) tested end-to-end
- No breaking changes to existing gameplay
- Documentation complete and runnable examples provided

**Estimated Plans:** 4-5

---

## Phase Dependencies

| Phase | Dependencies | Critical Path |
|-------|--------------|----------------|
| 1 | None | Setup first |
| 2 | Phase 1 | Foundation for all types |
| 3 | Phase 1, 2 | Can run parallel with 4 |
| 4 | Phase 1, 2, 3 | Depends on typed store |
| 5 | Phase 1, 2, 3, 4 | Requires all subsystems |
| 6 | Phase 5 | Last phase, validation |

**Parallelization:** Phases 3-4 can run in parallel after Phase 2 complete.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TypeScript Coverage | 100% (no `.js` in src/) | File count audit |
| Type Safety | 0 `any` types | TSC strict mode |
| Test Coverage | ≥80% on core systems | Istanbul report |
| Gameplay Regression | 0 issues in 1P/2P | Manual UAT |
| Load Time | No regression vs baseline | Browser DevTools |
| Frame Rate | No regression vs baseline | Performance monitoring |

---

## Post-Refactor Roadmap (Future)

When v2.0 complete, next milestones:

1. **Multiplayer Synchronization** — Network protocol, lag compensation, 2P online
2. **Arena Variants** — Multiple stage types, dynamic obstacles
3. **Game Mode: Arena** — 3+ player free-for-all, ranking system
4. **Performance Optimization** — Profiling, asset streaming, mobile support
5. **Bug Fix Sprint** — Audio issues, jank, menu edge cases (now easier to debug with clean architecture)

---

*Created: 2026-03-30 at roadmap initialization*
*Last updated: 2026-03-30*
