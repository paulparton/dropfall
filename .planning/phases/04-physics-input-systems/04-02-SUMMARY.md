---
phase: 04-physics-input-systems
plan: 02
subsystem: input
tags: [input, keyboard, gamepad, ai, handler]
dependency_graph:
  requires: [types/Input.ts]
  provides: [handlers/InputHandler.ts]
  affects: [entities/Player.js, ai/AIController.js]
tech_stack:
  added:
    - InputHandler class with subscriber pattern
    - Keyboard state tracking with configurable bindings
    - Gamepad polling with dead zone/threshold
    - AI controller integration
  patterns:
    - Observer/subscriber pattern for input events
    - Priority-based input source selection
    - Lazy initialization for gamepad polling
key_files:
  created:
    - src/handlers/InputHandler.ts
decisions:
  - Input priority: gamepad > keyboard > AI (matches gameplay expectation)
  - Default key bindings: WASD/arrows + space for boost
  - Gamepad dead zone: 0.15, threshold: 0.30 (from input.js)
---

# Phase 04 Plan 02 Summary: Unified Input Handler

**One-liner:** InputHandler normalizes keyboard, gamepad, and AI input to InputPayload with subscriber pattern

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | InputHandler class structure | 50eea00 | src/handlers/InputHandler.ts |
| 2 | Keyboard/gamepad sources | 50eea00 | src/handlers/InputHandler.ts |
| 3 | AI controller integration | 50eea00 | src/handlers/InputHandler.ts |

## Truths Validated

- InputHandler normalizes keyboard, gamepad, and AI input to InputPayload
- Player entity can receive input without knowing the source
- AI difficulty levels (easy, normal, hard) work through the handler

## Key Implementation Details

### InputHandler Class
- **Location:** `src/handlers/InputHandler.ts`
- **Exports:** `InputHandler`, `createInputHandler`
- **Pattern:** Subscriber/observer pattern for input events

### Source Priority
1. **Gamepad** (player 1) - highest priority
2. **Keyboard** - WASD or arrow keys
3. **AI** - when enabled via `enableAI()`

### Keyboard Handling
- Configurable key bindings (defaults: WASD/arrows + space for boost)
- State tracking for up/down/left/right/boost

### Gamepad Handling
- Polls `navigator.getGamepads()` each frame via `requestAnimationFrame`
- Dead zone: 0.15 (prevents stick drift)
- Threshold: 0.30 (for digital input detection)
- Supports up to 2 controllers

### AI Integration
- Imports `AIController` from `src/ai/AIController.js`
- Methods: `enableAI()`, `disableAI()`, `setDifficulty()`
- Difficulty levels: 'easy', 'normal', 'hard'
- `updateAI()` method for passing game state to AI

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None - no authentication required.

## Known Stubs

None - all functionality implemented.

## Self-Check: PASSED

- [x] InputHandler.ts exists in src/handlers/
- [x] InputHandler can be imported: `import { InputHandler } from './handlers/InputHandler'`
- [x] Keyboard input implemented (WASD/arrow keys)
- [x] Gamepad input implemented (detected and normalized)
- [x] AI input implemented with easy/normal/hard difficulty
- [x] TypeScript compiles (PhysicsSystem.ts error is pre-existing)

## Requirements Met

- [x] REQ-INPUT-01: Unified input handler normalizes keyboard/gamepad/AI
- [x] REQ-INPUT-02: AI difficulty levels (easy, normal, hard) work
- [x] REQ-INPUT-03: Input priority: gamepad > keyboard > AI

---

*Created: 2026-03-30*
*Plan: 04-physics-input-systems-02*
