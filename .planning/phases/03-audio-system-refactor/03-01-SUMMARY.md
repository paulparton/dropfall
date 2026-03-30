---
phase: 03-audio-system-refactor
plan: 01
subsystem: AudioSystem Core
tags: [audio, lifecycle, state-machine, web-audio, singleton]
dependency_graph:
  requires: []
  provides:
    - path: src/systems/AudioSystem.ts
      types: [AudioSystem class, AudioSystemEvent, getAudioSystem singleton]
    - path: tests/audio-system.test.ts
      tests: [30 test cases]
  affects:
    - src/audio.js (refactor target)
tech_stack:
  added:
    - AudioSystem class (200+ lines)
    - Web Audio API integration
    - Buffer caching
    - Event subscription system
  patterns:
    - Singleton pattern with lazy initialization
    - Lifecycle state machine (5 states)
    - Idempotent operations
    - Buffer cache for decoded audio
key_files:
  created:
    - src/systems/AudioSystem.ts (290 lines)
    - tests/audio-system.test.ts (400+ lines)
  modified:
    - src/types/Audio.ts (+6 lines - added loop property)
    - src/validation/schemas.ts (+100 lines - added audio schemas)
decisions:
  - Used lazy initialization pattern (no Web Audio in constructor) to comply with browser autoplay policies
  - Used singleton pattern with getAudioSystem() for global access
  - Created silent buffer fallback for tests when fetch fails
  - Added AudioSystemEvent type for internal events vs PlaybackEvent for external
metrics:
  duration: ""
  completed_date: 2026-03-30
---

# Phase 03 Plan 01: AudioSystem Core with Lifecycle State Machine Summary

## Objective

Create the core AudioSystem class with explicit lifecycle state machine and resource management. This is the foundation for all audio operations in Phase 3+.

## What Was Built

### AudioSystem Class (src/systems/AudioSystem.ts)

**1. Lifecycle State Machine (5 states)**
- `uninitialized` → `initializing` → `ready` → `playing` → `disposed`
- Tracks current position via `lifecycle_state` property
- State transitions emit events for external monitoring

**2. Core Methods**

- `initialize()` - Async, idempotent, lazy-init Web Audio context
  - Only creates AudioContext on first call (not in constructor)
  - Supports webkit prefix for Safari
  - Handles suspended state (resumes if needed)
  - Creates master gain node connected to destination

- `play(request: PlaybackRequest)` - Starts audio playback
  - Validates request via Zod schema
  - Checks lifecycle state before playing
  - Transitions to 'playing' state
  - Caches decoded buffers for reuse

- `stop()` - Stops all playback
  - Stops all active sources
  - Transitions back to 'ready' state

- `setVolume(level: number)` - Master volume control
  - Clamps values to 0-1 range
  - No-op if not initialized (safe)

- `dispose()` - Cleanup all resources
  - Stops playback
  - Clears buffer cache
  - Closes AudioContext
  - Clears all listeners
  - Transitions to 'disposed' state

**3. Additional Features**

- `subscribe(listener)` - Event subscription system
  - Returns unsubscribe function
  - Supports lifecycle-changed, playback-started, playback-stopped, error events

- `getVolume()` - Get current volume
- `isReady()` - Check if ready/playing
- `isDisposed()` - Check if disposed
- `getCachedBufferCount()` - Debug buffer count
- `getActiveSourceCount()` - Debug active sources

**4. Singleton Pattern**

- `getAudioSystem()` - Returns global AudioSystem instance
- `resetAudioSystem()` - Reset for testing

### Test Suite (tests/audio-system.test.ts)

**30 Test Cases Covering:**

1. **Lifecycle (4 tests)**
   - Starts in uninitialized state
   - Transitions to ready after initialize()
   - Emits lifecycle-changed events
   - Idempotent initialization

2. **Playback (6 tests)**
   - Throws if not initialized
   - Throws if disposed
   - Transitions to playing state
   - Validates input via schema
   - Accepts valid PlaybackRequest
   - Emits playback-started event

3. **Volume (3 tests)**
   - Clamps values 0-1
   - No-op if not initialized
   - Default volume 0.8

4. **Stop (3 tests)**
   - Transitions from playing to ready
   - Emits playback-stopped event
   - No-op if not playing

5. **Cleanup (6 tests)**
   - Closes audio context
   - Clears buffer cache
   - Unsubscribes listeners
   - Transitions to disposed
   - Is idempotent
   - Validates disposed state

6. **State Guards (5 tests)**
   - isReady() at various states
   - isDisposed() at various states

7. **Singleton (2 tests)**
   - Returns same instance
   - Can be reset

### Schema Additions (src/validation/schemas.ts)

- Added `SoundEffectSchema` - Validates sound effect objects
- Added `MusicTrackSchema` - Validates music track objects
- Added `AudioAssetSchema` - Discriminated union of effect/track
- Added `PlaybackRequestSchema` - Validates playback requests
- Added `validatePlaybackRequest()` - Validation function
- Added `validatePlaybackRequestResult()` - Safe parse function
- Added `validateAudioAsset()` - Asset validation function
- Added `validateAudioAssetResult()` - Safe parse function

### Type Extension (src/types/Audio.ts)

- Added `loop?: boolean` to PlaybackRequest interface

## Test Results

- **npm run type-check**: ✅ PASSED (0 errors)
- **npm test -- tests/audio-system.test.ts**: ✅ PASSED (30/30 tests)

```
Test Files  1 passed (1)
Tests       30 passed (30)
```

## Deviations from Plan

### Rule 1 - Auto-fix: Type mismatch resolved
- **Found during:** Implementation
- **Issue:** PlaybackRequest interface didn't have `loop` property used in AudioSystem
- **Fix:** Added `loop?: boolean` to PlaybackRequest interface in src/types/Audio.ts
- **Files modified:** src/types/Audio.ts

### Rule 2 - Auto-add: Missing validation schemas
- **Found during:** Implementation
- **Issue:** Plan referenced `validatePlaybackRequest()` but schema didn't exist
- **Fix:** Added PlaybackRequestSchema and validation functions to src/validation/schemas.ts
- **Files modified:** src/validation/schemas.ts (+100 lines)

## Known Stubs

None - AudioSystem is fully functional with:
- Complete lifecycle state machine
- All required methods implemented
- Buffer caching
- Event system
- Tests covering all major functionality

## Auth Gates

None - this task did not involve authentication.

## Self-Check: PASSED

- ✅ src/systems/AudioSystem.ts exists (290 lines)
- ✅ tests/audio-system.test.ts exists (400+ lines)
- ✅ Commit 8c8377c exists
- ✅ Type check passes with 0 errors
- ✅ All 30 tests pass

---

## Commits

- **8c8377c**: feat(03-01): create AudioSystem core with lifecycle state machine

