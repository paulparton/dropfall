# Phase 2: Core Type System & State Management - Context

**Gathered:** 2026-03-30  
**Status:** Ready for planning  
**Source:** ROADMAP.md Phase 2, REQUIREMENTS.md Active items

---

## Phase Boundary

Phase 2 delivers comprehensive TypeScript types for all game domains and migrates the Zustand store to a typed, validated interface. This is the foundation for typed development in phases 3-6.

**Goal:** Define TypeScript types for Game, Input, Physics, Audio, Network, and Entity domains. Migrate Zustand store to strict types with Zod validation. Set up patterns for validation and type safety.

**Output:** 7 new type files (types/*.ts), refactored store with validation, 0 `any` types, fully compatible with existing .js codebase.

---

## Implementation Decisions

### Core Type System (LOCKED)

- **types/Game.ts** — Game state interface, arena bounds, entity maps, lifecycle phases
- **types/Input.ts** — Input payload, handlers, source types (keyboard, gamepad, AI)
- **types/Physics.ts** — Rapier3D body handles, collision events, force payloads
- **types/Audio.ts** — Sound effect metadata, music lifecycle, playback state
- **types/Network.ts** — WebSocket message protocol, versioning, client/server types
- **types/Entity.ts** — Base entity interface with lifecycle hooks (init, update, destroy)

### Zustand Store Refactor (LOCKED)

- Migrate `src/store.js` to `src/store.ts` with full type annotations
- Add Zod schemas for validation on all mutations
- Preserve existing localStorage persistence
- Maintain API compatibility with existing code (no breaking changes)
- Pattern: `{ state, actions, validation }` exported from store

### Validation Strategy (LOCKED)

- Use Zod for runtime schema validation
- Create schemas for: network messages, store mutations, input payloads
- Schemas defined in `types/` directory alongside type definitions
- Pattern: `ZodSchema` alongside `TypeScript type` for each domain

### Type Guards & Refinements

- Create type guards for entity filtering (isPlayerAlive, isArenaCollider, etc.)
- Use discriminated unions for Input, Physics events, Network messages
- Pattern: `type predicate` functions exported from type files

### Project Structure Refactor (DEFERRED - Phase 2 Lite Scope)

- Creating `src/types/`, `src/systems/`, `src/handlers/`, `src/entities/` directories
- Moving existing code is deferred to Phase 5 (Entity System migration)
- Phase 2 only creates NEW type files in `src/types/` without moving existing code
- Existing `src/` files remain in place until Phase 5

---

## the agent's Discretion

- **Type file structure** — How to organize exports, whether to use namespace vs individual exports
- **Schema organization** — Whether to co-locate schemas with types or in separate schema file
- **Zod level of detail** — For example, how strict to be with number ranges, string validation
- **Documentation style** — JSDoc vs inline comments for type explanations
- **Test file structure** — Where to place type tests, naming convention

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — Validation section defines Entity-System pattern, Handler/Event pattern, Type Guards, Zod strategy
- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 2 goal and feature list

### Existing Code Dependencies
- [src/store.js](../../src/store.js) — Current Zustand store to be typed
- [src/entities/Player.js](../../src/entities/Player.js) — Existing entity to understand lifecycle needs
- [src/entities/Arena.js](../../src/entities/Arena.js) — Existing arena entity
- [src/online.js](../../src/online.js) — Existing network code for protocol to type
- [package.json](../../package.json) — Verify zod is installed (should be from Phase 1)

### Phase 1 Output
- [.planning/phases/01-typescript-foundation/01-01-SUMMARY.md](../01-typescript-foundation/01-01-SUMMARY.md) — TypeScript strict mode configured
- [.planning/phases/01-typescript-foundation/01-02-SUMMARY.md](../01-typescript-foundation/01-02-SUMMARY.md) — Build pipeline ready, npm packages installed

### Implementation Notes
- **Strict mode:** All types must pass TypeScript strict mode (--strict: true from Phase 1 tsconfig.json)
- **No any:** Zero implicit any types allowed
- **Existing JS compatibility:** Types must allow allowJs usage (existing .js files readable by IDE)
- **Test strategy:** See REQUIREMENTS.md Testing Strategy table for coverage targets

---

## Specifics

### Type File Exports

Each type file should export:
1. **Type/Interface** — Main type definition
2. **Type Guard** — Predicate function if applicable
3. **Zod Schema** — Runtime validation schema (aligned with type)
4. **Factory/Constructor** — If applicable for creating instances

Example structure (from REQUIREMENTS.md):
```typescript
// types/Physics.ts
export type PhysicsEvent = CollisionEvent | KnockbackEvent | OutOfBoundsEvent;
export const PhysicsEventSchema = z.union([
  z.object({ type: z.literal('collision'), ...}),
  // ...
]);
export function isCollisionEvent(e: unknown): e is CollisionEvent {
  return PhysicsEventSchema.parse(e).type === 'collision';
}
```

### Store Type Signature

Target signature:
```typescript
export const useGameStore = create<StoreState>()((set) => ({
  // Typed state
  gameMode: 'single-player' as const,
  players: [] as Player[],
  
  // Typed actions with validation
  setGameMode: (mode: GameMode) => { ... },
  addEntity: (entity: Entity) => { ... },
}));

// Export validation
export const StoreValidation = { ... };
```

### Network Protocol Types

From online.js, extract message types:
- `JoinGame`, `StartRound`, `PlayerMove`, `RoundEnd`, etc.
- Create discriminated union: `NetworkMessage = JoinGame | StartRound | ...`
- Version field: `{ type, version, payload }`

---

## Deferred Ideas

- **Project structure reorganization** — Moving existing .js files to src/types/, src/systems/, etc. moves to Phase 5
- **Entity system implementation** — Full Entity base class with lifecycle hooks (Phase 5)
- **Audio/Physics/Input system extraction** — Full system classes (Phases 3-4)
- **Store persistence migration** — Currently uses localStorage; deeper refactor deferred to post-Phase 2

---

*Phase: 02-core-type-system-state-management*  
*Context gathered: 2026-03-30 via ROADMAP.md requirements*
