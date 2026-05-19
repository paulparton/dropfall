# Phase 3: Audio System Refactor — Planning Complete

**Status:** ✅ COMPLETE — Ready for execution

**Commit:** d5eb0b2 (`docs(phase-3): create 3 detailed execution plans with wave structure`)

---

## Planning Overview

**Phase Goal:** Extract audio logic into `AudioSystem` class with explicit lifecycle and race condition prevention.

**Planning Process:**
1. Created 03-CONTEXT.md with 5 locked design decisions
2. Derived 3 execution plans from ROADMAP + requirements
3. Wave structure: Wave 1 (parallel plans 01-02), Wave 2 (plan 03)
4. Identified dependencies and resource constraints
5. Updated ROADMAP with finalized plan list

---

## Plans Created

### Plan 03-01: AudioSystem Core with Lifecycle State Machine
**Status:** Wave 1 (Ready to execute)
**Location:** `.planning/phases/03-audio-system-refactor/03-01-PLAN.md`
**Tasks:** 2
- Task 1: Create src/systems/AudioSystem.ts with lifecycle (200+ lines)
- Task 2: Create tests/audio-system.test.ts with 15+ lifecycle tests
**Requirements:** AUDIO-01
**Output:** AudioSystem class, lifecycle test suite
**Verification:** `npm run type-check` (0 errors), `npm test -- tests/audio-system.test.ts` (all passing)

### Plan 03-02: Audio Event Types & Validation Schemas
**Status:** Wave 1 (Ready to execute)
**Location:** `.planning/phases/03-audio-system-refactor/03-02-PLAN.md`
**Tasks:** 2
- Task 1: Extend src/types/Audio.ts with PlaybackRequest, PlaybackEvent, type guards
- Task 2: Add Zod schemas to src/validation/schemas.ts (5+ new schemas)
**Requirements:** AUDIO-02
**Output:** Extended type definitions, 5 new validation schemas
**Verification:** `npm run type-check` (0 errors), export count validation

### Plan 03-03: Integration Tests for Race Conditions & Memory Safety
**Status:** Wave 2 (Depends on 03-01, 03-02)
**Location:** `.planning/phases/03-audio-system-refactor/03-03-PLAN.md`
**Tasks:** 2
- Task 1: Create tests/audio-system-integration.test.ts with 20+ integration tests
- Task 2: Optional race condition guards (if needed after testing)
**Requirements:** AUDIO-03, AUDIO-04
**Output:** Integration test suite covering concurrency and memory safety
**Verification:** `npm test -- tests/audio-system-integration.test.ts` (all passing)

---

## Wave Structure

```
Wave 1 (Parallel):
├─ 03-01: AudioSystem core + unit tests
└─ 03-02: Audio types + validation schemas
  
Wave 2 (Sequential after Wave 1):
└─ 03-03: Integration tests (race conditions, memory safety)
```

**Execution Path:**
1. Execute 03-01 and 03-02 in parallel (independent file changes)
2. Once Wave 1 complete, execute 03-03 (depends on AudioSystem + schemas)
3. **Total estimated execution time:** 60-90 minutes agent time

---

## Requirements Coverage

**Phase 3 Requirements (from ROADMAP):**
- AUDIO-01: AudioSystem class with lifecycle ✓ (Plan 03-01)
- AUDIO-02: Event types and validation ✓ (Plan 03-02)
- AUDIO-03: Integration tests ✓ (Plan 03-03)
- AUDIO-04: Memory safety verification ✓ (Plan 03-03)

**All requirements addressed in plans.**

---

## Design Decisions Reference

**From 03-CONTEXT.md (Locked Decisions):**

| Decision | Plan Impact |
|----------|------------|
| D-01: Initialize on first input | 03-01 (AudioSystem.initialize()) |
| D-02: 4-state lifecycle | 03-01 (lifecycle state machine) + 03-02 (types) |
| D-03: Explicit memory cleanup | 03-03 (memory safety tests) |
| D-04: Error handling strategy | 03-01 (throw on invalid state) + 03-02 (error schemas) |
| D-05: Singleton pattern | 03-01 (getAudioSystem() singleton) |

**All locked decisions reflected in task specifications.**

---

## Verification Gate

**Pre-Execution Checklist:**

- [ ] Phase 2 fully complete (verify STATE.md status)
- [ ] Phase 2 types available (Entity.ts, Game.ts, Audio.ts, etc.)
- [ ] Package.json has Zustand + Zod (installed in Phase 2)
- [ ] ROADMAP updated with Phase 3 plan list
- [ ] 03-CONTEXT.md created with design decisions

**Current Status:** All items checked ✅

---

## Next Steps

**Immediate Action:**
```bash
/gsd-execute-phase 3
```

**Execution will:**
1. Load Wave 1 tasks (03-01, 03-02)
2. Execute 03-01 and 03-02 in parallel agents
3. Verify both complete successfully
4. Execute Wave 2 (03-03) after Wave 1 passes verification

**Expected Output after Phase 3 Complete:**
- `src/systems/AudioSystem.ts` (200+ lines)
- `src/types/Audio.ts` extended with PlaybackRequest/Event types
- `src/validation/schemas.ts` extended with 5 audio schemas
- `tests/audio-system.test.ts` (15+ unit tests, all passing)
- `tests/audio-system-integration.test.ts` (20+ integration tests, all passing)
- `npm run type-check` → 0 errors
- `npm test` → 35+ audio-related tests passing

---

## Context for Executors

**Key Artifacts from Phase 2:**
- `src/types/Audio.ts` — AudioLifecycle, AudioContext base types
- `src/store.ts` — Zustand store for state management
- `src/validation/schemas.ts` — Zod schema patterns (established in Phase 2)

**New Artifacts to Create (Phase 3):**
- `src/systems/` directory (new, for system classes)
- `src/systems/AudioSystem.ts` (core class)
- Extended `src/types/Audio.ts` (PlaybackRequest, PlaybackEvent)
- Extended `src/validation/schemas.ts` (audio validation)
- `tests/audio-system.test.ts` (new, unit tests)
- `tests/audio-system-integration.test.ts` (new, integration tests)

**TypeScript Constraints:**
- Strict mode enabled (all type safety flags on)
- No `any` types without justification
- All imports typed
- Exported types must be used in consumers

**Testing Constraints:**
- Vitest for all tests
- Tests must be discoverable by `.test.ts` pattern
- 100% pass rate required
- Integration tests must cover race conditions

---

**Planning Created:** 2026-03-30
**Planner:** GitHub Copilot (Claude Haiku 4.5)
**Phase Status:** Ready for execution
