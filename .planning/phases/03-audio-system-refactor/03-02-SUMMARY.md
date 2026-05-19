---
phase: 03-audio-system-refactor
plan: 02
subsystem: Audio Types & Validation
tags: [audio, types, validation, zod, lifecycle-events]
dependency_graph:
  requires: []
  provides:
    - path: src/types/Audio.ts
      types: [PlaybackRequestDirect, PlaybackEventLifecycle, type-guards]
    - path: src/validation/schemas.ts
      schemas: [PlaybackRequestDirectSchema, PlaybackEventLifecycleSchema]
  affects:
    - src/systems/AudioSystem.ts
tech_stack:
  added:
    - zod (for validation schemas)
    - type guard functions
    - discriminated union types
  patterns:
    - safeParse for non-throwing validation
    - discriminated union for event types
    - type narrowing with type guards
key_files:
  created: []
  modified:
    - src/types/Audio.ts (+65 lines)
    - src/validation/schemas.ts (+118 lines)
decisions:
  - Used PlaybackRequestDirect name to avoid conflicting with existing PlaybackRequest
  - Used PlaybackEventLifecycle name to distinguish from existing PlaybackEvent
  - Maintained backward compatibility with existing audio types and schemas
metrics:
  duration: ""
  completed_date: 2026-03-30
---

# Phase 03 Plan 02: Audio Event Types and Validation Schemas Summary

## Objective
Add lifecycle hook types and validation schemas for AudioSystem events and requests. This enables type-safe event handling and request validation in Phase 3 Wave 2.

## What Was Added

### Audio Types (src/types/Audio.ts)

1. **PlaybackRequestDirect Interface**
   - `url`: string (required) - Audio file URL to play
   - `loop`: boolean (optional, defaults to false)
   - `volume`: number (optional, defaults to 0.8)

2. **PlaybackEventLifecycle Type** - Discriminated union with 4 event types:
   - `{ type: 'lifecycle-changed'; state: AudioLifecycle }`
   - `{ type: 'playback-started'; url: string }`
   - `{ type: 'playback-stopped' }`
   - `{ type: 'error'; message: string }`

3. **Type Guard Functions**:
   - `isLifecycleEvent(event)` - narrows to lifecycle-changed
   - `isPlaybackStartedEvent(event)` - narrows to playback-started
   - `isErrorEvent(event)` - narrows to error

### Validation Schemas (src/validation/schemas.ts)

1. **PlaybackRequestDirectSchema**
   - Validates URL (must be valid URL)
   - loop: optional boolean, defaults to false
   - volume: optional number 0-1, defaults to 0.8

2. **PlaybackEventLifecycleSchema** - Zod discriminated union with 4 variants:
   - lifecycle-changed: includes AudioLifecycleSchema
   - playback-started: includes url string
   - playback-stopped: empty object
   - error: includes message string

3. **Validator Functions**:
   - `validatePlaybackRequestDirect(request)` - safeParse for PlaybackRequestDirect
   - `validatePlaybackEvent(event)` - safeParse for PlaybackEventLifecycle
   - `validatePlaybackEventLifecycle(event)` - alias for above

4. **Type Guard Functions**:
   - `isValidPlaybackRequest(request)` - runtime type check
   - `isValidPlaybackRequestDirect(request)` - runtime type check for direct requests
   - `isValidPlaybackEvent(event)` - runtime type check
   - `isValidPlaybackEventLifecycle(event)` - alias for above

## Test Results

- **npm run type-check**: ✅ PASSED (0 errors)
- Type safety verified for all new types and schemas

## Deviations from Plan

### Rule 1 - Auto-fix: Naming conflicts resolved
- **Found during:** Implementation
- **Issue:** Original plan specified adding `PlaybackRequest` and `PlaybackEvent` but these already existed in the codebase with different structures
- **Fix:** Used distinct names `PlaybackRequestDirect` and `PlaybackEventLifecycle` to maintain backward compatibility while adding the required new functionality
- **Files modified:** src/types/Audio.ts, src/validation/schemas.ts

## Known Stubs

None - all added types are fully wired with corresponding Zod schemas and validation functions.

## Auth Gates

None - this task did not involve authentication.

## Self-Check: PASSED

- ✅ src/types/Audio.ts exists with new types
- ✅ src/validation/schemas.ts exists with new schemas  
- ✅ Commit 8f478bd exists
- ✅ Type check passes with 0 errors
