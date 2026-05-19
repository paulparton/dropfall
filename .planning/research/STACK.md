# Research: Stack Requirements for Racing Mode

**Context:** Adding racing game mode to existing Dropfall multiplayer game built on Three.js + Rapier3D physics engine.

## Current Stack (Verified)
- **3D Engine:** Three.js (r155+)
- **Physics Engine:** Rapier3D WASM with gravity y=-20.0
- **State Management:** Zustand
- **Rendering:** Three.js + EffectComposer (bloom, post-processing)
- **Audio:** Web Audio API
- **Input:** Keyboard, gamepad, touch abstractions

## NO NEW DEPENDENCIES REQUIRED FOR V1

The existing stack **already supports racing mode**. Key reasons:

### Physics
- Rapier3D handles all racing mechanics: gravity, momentum, acceleration, collision
- Current gravity (-20.0) creates natural "arcade racing" feel
- Ball physics (mass, restitution, friction) are tweakable for racing pacing
- No need for specialized racing physics library

### Rendering
- Three.js + bloom already delivers Mario Kart visual polish
- Existing particle/lightning/shockwave effects perfect for boost/speed visual feedback
- Theme system (materials, colors) easily adapted to "race track" aesthetic
- No additional shader complexity needed beyond current SDF work in progress

### State Management
- Game mode selection (GAME_MODE_SELECT state) already structured
- Zustand can track: lap time, speed, current lap, best lap, finish state
- No additional state complexity beyond what's already structured

## Potential Enhancements (Future, NOT v2.2 scope)

If future racing features expand:
- **Multiplayer Racing:** Existing online.js architecture scales to race events
- **Advanced Graphics:** Could add motion blur shaders, tire track trails (low-prio)
- **Telemetry:** Could integrate minimal analytics for speed/time tracking
- **Leaderboards:** Server extension to persist race times (not v2.2)

## Integration Points (Within Existing Code)

1. **Game Store** (`src/store.js`) → Add race mode state (lap count, speed, best time)
2. **Game Loop** (`src/main.js`) → Route to racing update branch when in RACE mode
3. **Arena** (`src/entities/Arena.js`) → Create DynamicTrack variant or inherited class
4. **Physics** (`src/physics.js`) → Existing, no changes
5. **Renderer** (`src/renderer.js`) → Existing, no changes
6. **Input** (`src/input.js`) → Existing, no changes

## Version Verification

- Three.js: ✓ Current version has all required features
- Rapier3D: ✓ WASM binding supports dynamic bodies, colliders, raycasts
- Zustand: ✓ No version constraints, store easily extended
- Web Audio: ✓ Browser standard, no version concerns

## Conclusion

**Stack Status:** COMPLETE — No dependencies to add. Racing mode built entirely within existing abstraction layers.

**Risk:** LOW — All required tech is proven and in use. Racing is primarily a **content** and **UX** problem, not a tech problem.
