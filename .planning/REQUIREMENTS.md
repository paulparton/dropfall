---
version: 1
date: 2026-03-30
---

# Dropfall v2.0 Requirements

## Validated

- ✓ **Single-player mode with AI** — 1P mode with Easy/Normal/Hard AI opponent (from Wave 1-2)
- ✓ **Two-player mode** — Frame-based gameplay for 2 human players (existing)
- ✓ **Game mode selection UI** — Menu transitions for 1P/2P and difficulty (from Wave 1-2)
- ✓ **Arena collision physics** — Players knocked off-screen trigger loss (existing Rapier3D)
- ✓ **Power-up system** — Health, shield, special attacks (existing)
- ✓ **HUD display** — Player stats, scores, round info (existing)
- ✓ **Audio system** — Background music, collision sounds (existing, to be refactored)
- ✓ **Gamepad/keyboard input** — Xbox/PS controllers + keyboard (existing)
- ✓ **Multiplayer networking** — WebSocket foundation for 2P online (existing online.js)

## Active

- [ ] **TypeScript strict mode** — All code typed, no `any`, strict null checks enabled
- [ ] **Entity lifecycle system** — Base class with init/update/destroy hooks, state machine
- [ ] **Input handler pattern** — Decouple keyboard/gamepad/AI input from Player movement logic
- [ ] **Physics event system** — Collision/knockback events instead of direct physics queries
- [ ] **Audio lifecycle management** — Initialize audio on first input, graceful unload
- [ ] **Validation schema (Zod)** — Runtime validation for network messages, store mutations, input payloads
- [ ] **Test coverage ≥80%** — Unit tests for Input, Physics, State, AI; integration tests for 1P/2P flows
- [ ] **Project structure refactor** — Reorganize `src/` into: `types/`, `systems/`, `entities/`, `handlers/`, `utils/`
- [ ] **Type definitions** — Entity, Physics, Input, Audio, Store types; no implicit `any`
- [ ] **Online protocol versioning** — Ensure multiplayer messages are versioned and validated
- [ ] **Memory management tests** — Ensure proper cleanup of event listeners, textures, audio
- [ ] **Documentation** — System overview, entity lifecycle, common patterns, testing guide

## Implementation Notes

### TypeScript Migration Strategy

1. **Phase 1: Foundation** — Set up TS config, build pipeline, core types
2. **Phase 2: Systems** — Migrate isolated systems (Audio, Renderer, etc.)
3. **Phase 3: Entities** — Create entity base class, migrate Player/Arena/Effects
4. **Phase 4: Input & Game Loop** — Integrate handlers, tie systems together
5. **Phase 5: Testing** — Add integration tests, verify 1P/2P/AI scenarios
6. **Phase 6: Cleanup** — Remove old JS, optimize build

### Architecture Patterns

**Entity-System Pattern:**
```typescript
class Entity {
  id: string;
  state: 'created' | 'ready' | 'active' | 'destroyed';
  
  async initialize(context: GameContext): Promise<void> {...}
  update(deltaTime: number, context: GameContext): void {...}
  async destroy(): Promise<void> {...}
}
```

**Handler/Event Pattern:**
```typescript
// Input decoupled from Player
const inputHandler = createInputHandler({ keyboard, gamepad, ai });
inputHandler.subscribe((input) => {
  player.handleInput(input); // Simple, testable
});

// Physics events instead of synchronous queries
physics.on('collision', (events) => {
  events.forEach(e => game.handleCollision(e));
});
```

**Type Guards:**
```typescript
function isPlayerAlive(entity: Entity): entity is Player {
  return entity.type === 'player' && entity.health > 0;
}

function ensurePlayer(entity: Entity): Player {
  if (!isPlayerAlive(entity)) throw new Error(`Expected alive Player, got ${entity.id}`);
  return entity as Player;
}
```

### Testing Strategy

| System | Unit Tests | Integration | Coverage Target |
|--------|-----------|-------------|-----------------|
| Input (keyboard/gamepad/AI) | ✓ Mock events, verify output | ✓ With Player | 85% |
| Physics | ✓ Mock Rapier bodies, verify events | ✓ With Arena | 80% |
| State (Zustand store) | ✓ Actions, mutations, persistence | ✓ Full game flow | 85% |
| Audio | ✓ Mock Web Audio, lifecycle | ✓ With input triggering | 70% |
| AI Controller | ✓ Position inputs, output commands | ✓ In 1P game | 90% |
| Entities (Player/Arena) | ✓ Lifecycle, state transitions | ✓ With physics/input | 80% |
| Game Loop | ✓ Frame scheduling test | ✓ Full 1P/2P gameplay | 75% |

### Validation with Zod

```typescript
// Network protocol
const NetworkMessageSchema = z.union([
  z.object({ type: z.literal('move'), payload: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ type: z.literal('boost'), payload: z.undefined() }),
]);

// Store mutations
const StoreMutationSchema = z.object({
  gameMode: z.enum(['1P', '2P']),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  playerNames: z.tuple([z.string(), z.string()]),
});

// Input payload
const InputPayloadSchema = z.object({
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  boost: z.boolean(),
});
```

## Out of Scope

- Bug fixes for audio glitches, jank, menu issues — Post-refactor debugging phase
- UI redesign — Keep current UI, improve backend structure only
- New game modes or stages — Prerequisite architecture comes first
- Performance optimization beyond structural improvements — Separate phase
- Mobile/touch controls — Beyond current scope

## Acceptance Criteria

For each requirement to move from Active → Validated:

1. **Code completed** — Feature implemented in TypeScript with types
2. **Tests pass** — Unit/integration tests covering success + error paths
3. **No regression** — 1P/2P gameplay identical to baseline
4. **Type safety** — No `any` types, strict null checks enabled
5. **Docs updated** — System overview or pattern examples added
6. **Performance baseline met** — Load time and frame rate ≥ current

---
*Last updated: 2026-03-30 at requirements initialization*
