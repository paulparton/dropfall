# Phase 5 Context: Entity System & Game Loop

## Phase Overview

**Goal:** Create Entity base class and lifecycle hooks. Migrate Player/Arena/Effects to typed entities. Integrate all systems into main game loop.

## Dependencies from Previous Phases

| Phase | Deliverables |
|-------|-------------|
| Phase 1 | TypeScript strict mode, build pipeline |
| Phase 2 | Core types (Entity.ts, Game.ts, Input.ts, etc.) |
| Phase 3 | AudioSystem with lifecycle |
| Phase 4 | PhysicsSystem, InputHandler |

## What Exists Now

### Types (Phase 2)
- `src/types/Entity.ts` - Entity interfaces
- `src/types/Game.ts` - Game state types

### Systems (Phases 3-4)
- `src/systems/PhysicsSystem.ts`
- `src/systems/AudioSystem.ts`
- `src/handlers/InputHandler.ts`

### Entities (Still JS)
- `src/entities/Player.js`
- `src/entities/Arena.js`
- `src/entities/ParticleSystem.js`
- `src/entities/LightningSystem.js`
- `src/entities/ShockwaveSystem.js`

### Main
- `src/main.js` - Still JavaScript

## Implementation Order

1. **05-01:** Create Entity.base.ts (abstract base class)
2. **05-02:** Migrate Player.js → Player.ts
3. **05-03:** Migrate Arena.js → Arena.ts
4. **05-04:** Migrate effect systems to TS
5. **05-05:** Refactor main.js → main.ts, integrate lifecycle
6. **05-06:** Integration tests

## Key Decisions Needed

- Should Entity.base be abstract class or interface extension?
- How to handle legacy .js imports during migration?
- Game loop architecture: system-based or entity-based?

## Risks

- Breaking changes to main.js during migration
- TypeScript strict mode may require fixing existing code
- Test coverage gaps during transition
