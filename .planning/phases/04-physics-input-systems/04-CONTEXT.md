---
gathered: 2026-03-30
source: ROADMAP.md + Phase 2 types + existing codebase analysis
status: Ready for planning
---

# Phase 4: Physics & Input Systems - Context

## Phase Boundary

**What we're building:** Extract physics queries into typed event system. Create input handler pattern decoupling keyboard/gamepad/AI from Player.

**Input contracts (from Phase 2):**
- `InputPayload` type: KeyboardInput | GamepadInput | AIInput (discriminated union)
- `InputHandler` interface: subscribe, dispatch, getLastInput, destroy
- `PhysicsEvent` type: CollisionEvent | KnockbackEvent | OutOfBoundsEvent
- `PhysicsWorld` interface: step, createDynamicBody, destroyBody, queryCollisions, applyForce

**Output contracts (will create):**
- `src/systems/PhysicsSystem.ts` — Event-based physics system
- `src/handlers/InputHandler.ts` — Unified input handler (keyboard, gamepad, AI)
- Tests covering input combinations, physics events

## Implementation Decisions

### D-01: Physics Event Emission
- **Decision:** Replace direct physics queries with event subscription pattern
- **Rationale:** Decouples physics from game logic, enables testing without Rapier
- **Pattern:** PhysicsSystem emits events, game subscribes

### D-02: Input Handler Sources
- **Decision:** Support 3 input sources via unified handler: keyboard, gamepad, AI
- **Rationale:** Player entity shouldn't know where input comes from
- **Pattern:** InputHandler normalizes all sources to InputPayload

### D-03: AI Integration
- **Decision:** AIController outputs AIInput, InputHandler manages AI difficulty switching
- **Rationale:** Keep AI logic in AIController, handler just normalizes
- **Difficulty levels:** easy, normal, hard (from existing AIController)

### D-04: Input Priority
- **Decision:** gamepad > keyboard > AI (if gamepad connected, it takes priority)
- **Rationale:** Natural fallback chain, hot-swappable controllers
- **Pattern:** InputHandler checks sources in order, returns first active

### D-05: Physics State Machine
- **Decision:** PhysicsSystem has explicit states: uninitialized → ready → stepping → disposed
- **Rationale:** Prevents queries before physics is ready
- **Pattern:** Use state guard before emit

### the agent's Discretion
- Touch controls (mobile) - currently in input.js, keep or migrate?
- Input polling interval (currently every frame)
- Physics interpolation factor handling
- Event buffer size vs real-time

## Canonical References

**Downstream agents MUST read these:**

### Type Definitions (Phase 2)
- `src/types/Input.ts` — InputPayload, InputHandler interface, type guards
- `src/types/Physics.ts` — PhysicsEvent, CollisionEvent, KnockbackEvent, OutOfBoundsEvent
- `src/validation/schemas.ts` — Existing Zod schemas (reference pattern)

### Existing Implementation (Pattern Reference)
- `src/physics.js` — Current physics (to be refactored into PhysicsSystem)
- `src/input.js` — Current input handling (to be refactored into InputHandler)
- `src/ai/AIController.js` — AI controller with difficulty levels
- `src/systems/AudioSystem.ts` — Phase 3 system pattern to follow

### Architecture (Phase 1)
- `tsconfig.json` — TypeScript configuration

## Specific Constraints

1. **Rapier3D:** Continue using @dimforge/rapier3d-compat (existing)
2. **No external input libraries** — Use native keyboard/gamepad APIs
3. **Backward compatibility:** Preserve existing 1P/2P controls
4. **AI difficulty:** 3 levels must work (easy, normal, hard)
5. **No breaking changes:** Existing gameplay must work after refactor

## Deferred Ideas

The following are out of scope for Phase 4:
- Touch controls migration (keep in input.js for now)
- Network input synchronization (Phase 5+)
- Input recording/playback (future)
- Motion controller support (future)

---

*Phase: 04-physics-input-systems*
*Context generated: 2026-03-30*
*Source: ROADMAP.md + Phase 2 types + existing codebase*
