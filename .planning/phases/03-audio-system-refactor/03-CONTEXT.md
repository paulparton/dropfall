---
gathered: 2026-03-30
source: Phase 2 completion + ROADMAP analysis
status: Ready for planning
---

# Phase 3: Audio System Refactor - Context

## Phase Boundary

**What we're building:** Extract audio logic from audio.js into a typed AudioSystem class with explicit lifecycle management. Remove race conditions in Web Audio API initialization. Support reliable audio playback and music persistence across game rounds.

**Input contracts (from Phase 2):**
- `AudioLifecycle` type: 'uninitialized' → 'initializing' → 'ready' → 'playing' → 'disposed'
- `AudioContext` interface: methods (play, stop, setVolume, dispose) + lifecycle property
- `PlaybackRequest` and `PlaybackEvent` types for playback management
- `isAudioReady()` type guard to check initialization state

**Output contracts (will create):**
- `AudioSystem` class — Main audio management system
- `src/systems/AudioSystem.ts` — Implementation with lifecycle hooks
- Tests covering lifecycle, race conditions, memory cleanup
- Audio validation schema (from Phase 2) integrated for safety

## Implementation Decisions

### D-01: Initialization Strategy
- **Decision:** Initialize Web Audio context on first user input (not on page load)
- **Rationale:** Avoids zombie audio processes, aligns with browser policies (autoplay restrictions)
- **Pattern:** Use `isAudioReady()` guard before any playback attempt
- **Backward compatibility:** Preserve existing audio.js event patterns during transition

### D-02: Lifecycle Hooks
- **Decision:** Support 4 explicit lifecycle phases: uninitialized → initializing → ready → playing → disposed
- **Rationale:** Clear state machine prevents race conditions (no ambiguous "almost ready" states)
- **Hooks:** on-input-init, on-game-start, on-round-end, on-game-end for state transitions
- **Pattern:** Each hook has predetermined side effects (buffer loads, cleanup, etc.)

### D-03: Memory Management
- **Decision:** Explicit cleanup in dispose() — unload all audio buffers, detach listeners, stop playback
- **Rationale:** Prevents memory leaks from dangling Web Audio API objects
- **Testing:** Verify buffer count decreases after dispose()

### D-04: Error Handling
- **Decision:** Throw on invalid state transitions (e.g., play before ready), NOT on network/buffer load failures
- **Rationale:** Network/codec failures are retryable; state errors are bugs
- **Pattern:** Log warnings for network issues, let caller decide retry strategy

### D-05: Integration Pattern
- **Decision:** AudioSystem is a singleton service, initialized lazily
- **Rationale:** Single source of truth for audio state, no race conditions from multiple instances
- **Access:** Inject via store or game context (not global)

### the agent's Discretion
- Internal buffer caching strategy (preload vs on-demand)
- Volume normalization approach for different audio types
- Retry logic for failed buffer loads (backoff strategy)
- Visualization/debugging support (optional)

## Canonical References

**Downstream agents MUST read these:**

### Type Definitions (Phase 2)
- `src/types/Audio.ts` — AudioContext, AudioLifecycle, PlaybackRequest, PlaybackEvent
- `src/types/Game.ts` — GameState with round/phase lifecycle
- `src/validation/schemas.ts` — AudioContextSchema with runtime validation

### Existing Implementation (Pattern Reference)
- `src/audio.js` — Current audio management (to be refactored)
- `src/store.ts` — Zustand store structure (for service injection)

### Architecture (Phase 1)
- `tsconfig.json` — TypeScript configuration (reference for strict mode)

## Specific Constraints

1. **Web Audio API:** Target modern browsers (Chrome, Firefox, Safari, Edge)
2. **File format:** Support .mp3, .wav, .webm (existing in codebase)
3. **Playback modes:** Background music (looped), sound effects (one-shot)
4. **Volume:** Music vs SFX separate volume controls (from existing store)
5. **No external audio libraries** — Use only Web Audio API (no WebAudio.js, Tone.js, etc.)

## Deferred Ideas

The following are out of scope for Phase 3:
- 3D audio positioning (spatial audio) → Phase 5+
- Audio visualization / spectrum analyzer → Phase 5+
- Streaming/network audio → Future
- Audio effects processing (EQ, reverb) → Future
- Multi-language support for audio → Phase 6

---

*Phase: 03-audio-system-refactor*  
*Context generated: 2026-03-30*  
*Source: Phase 2 completion + ROADMAP analysis*
