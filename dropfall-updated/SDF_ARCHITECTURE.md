# Dropfall: SDF Game Engine Architecture

## Overview
A complete rewrite of Dropfall using Signed Distance Fields (SDF) for rendering and physics. This version uses ray-marching in GLSL shaders instead of traditional polygon-based rendering, providing crisp, scalable graphics and more efficient collision detection.

## Key Components

### 1. SDF Ray-Marching Renderer
- **File**: `src/sdf/renderer.js`
- Uses WebGL with custom GLSL shaders for ray-marching
- Renders all game elements mathematically using distance functions
- Supports dynamic lighting and post-effects

### 2. Physics System
- **File**: `src/sdf/physics.js`
- Lightweight physics engine using SDF for collision detection
- Maintains rigid body dynamics for player spheres and arena tiles
- Continuous collision detection using distance functions

### 3. SDF Scene Geometry
- **File**: `src/sdf/sdf-functions.glsl`
- Comprehensive library of SDF primitives (sphere, hexagonal prism, box, etc.)
- Composite functions for arena construction
- Smooth blending operations for visual continuity

### 4. Game State & Logic
- **File**: `src/sdf/game-engine.js`
- Core game loop and state management
- Player input handling
- Tile destruction, power-ups, and effects system
- Persists all original gameplay mechanics

### 5. Effects System
- **File**: `src/sdf/effects.js`
- Particle effects using SDF and procedural generation
- Lightning effects via shader-based path tracing
- Shockwaves and impact rings

### 6. Audio System
- **File**: `src/audio.js` (reused from original)
- Music and sound effects
- Audio-visual synchronization

## Technical Advantages

### Performance
- Single shader-based rendering pass
- No polygon count limitations
- Efficient collision detection via distance queries
- Reduced memory footprint for geometry

### Visual Quality
- Perfect anti-aliasing
- Crisp edges at any zoom level
- Procedural texture generation
- Hardware-accelerated ray-marching (GPU)

### Scalability
- Resolution-independent rendering
- Infinitely detailed scenes via procedural generation
- Real-time effect updates without mesh recreation

## File Structure

```
src/
├── sdf/
│   ├── renderer.js           # Main SDF renderer & WebGL setup
│   ├── physics.js            # Physics engine using SDF collision
│   ├── game-engine.js        # Core game loop and logic
│   ├── effects.js            # Particle, lightning, shockwave effects
│   ├── sdf-functions.glsl    # GLSL SDF primitive library
│   ├── ray-march.glsl        # Main ray-marching shader
│   └── composite.glsl        # Post-processing & compositing shaders
├── main.js                   # Entry point (modified for SDF)
├── input.js                  # Input handling (reused)
├── audio.js                  # Audio system (reused)
├── store.js                  # State management (reused)
└── style.css                 # Styles (reused)
```

## Core Concepts

### Ray-Marching
- Cast rays from camera into scene
- Step along ray using SDF distance estimates
- Stop when hit surface or reach max distance
- Compute normals via SDF gradient for lighting

### SDF Collision Detection
- Query scene SDF at object positions
- If SDF < object radius, collision detected
- Collision response calculated from SDF gradient
- More reliable than polygon-based collision

### Procedural Scene Composition
- Combine simple SDFs using min/max operations
- Create complex geometry without meshes
- Dynamic scene updates via uniform parameter changes

## Performance Characteristics

| Aspect | Advantage |
|--------|-----------|
| Rendering | O(1) geometry regardless of complexity |
| Collision | O(1) per query, no broad-phase needed |
| Memory | Constant overhead (no mesh storage) |
| Scalability | Infinite detail capability |
| Effects | GPU-accelerated, no CPU particles |

## Implementation Phases

1. **Phase 1**: Core SDF renderer and basic geometry
2. **Phase 2**: Physics and collision detection
3. **Phase 3**: Game logic port and controls
4. **Phase 4**: Effects system (particles, lightning, shockwaves)
5. **Phase 5**: UI, audio, and polish
6. **Phase 6**: Optimization and feature completion

## Gameplay Preservation

All original features maintained:
- ✓ 2-player local multiplayer
- ✓ 8 power-up types with visual effects
- ✓ Destructible hexagonal tile arena
- ✓ Ice, portal, and bonus tiles
- ✓ Dynamic arena effects
- ✓ Boost system
- ✓ Multiple themes and presets
- ✓ Settings persistence
- ✓ Audio system
- ✓ Score tracking

## Shader Architecture

### Main Ray-March Shader
```glsl
void main() {
    // 1. Generate ray from camera through pixel
    vec3 ro = cameraPos;
    vec3 rd = normalize(rayDir);
    
    // 2. March along ray to find hit point
    float dist = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        float d = sceneSDF(ro + d * rd);
        if (d < EPSILON) break;
        dist += d;
        if (dist > MAX_DIST) break;
    }
    
    // 3. Calculate hit point and normal
    vec3 hitPoint = ro + dist * rd;
    vec3 normal = calcNormal(hitPoint);
    
    // 4. Apply lighting and effects
    vec3 color = phongLighting(hitPoint, normal, rd);
    
    // 5. Apply post-effects (bloom, etc)
    color = applyPostEffects(color);
    
    gl_FragColor = vec4(color, 1.0);
}
```

## Collision Detection via SDF

```glsl
float sceneSDF(vec3 p) {
    // Distance to nearest surface
    float d = MAX_DIST;
    
    // Player spheres
    d = min(d, sdSphere(p - playerPos, playerRadius));
    
    // Arena hexagonal tiles
    d = min(d, sdHexagonalArena(p));
    
    // Active effects and obstacles
    d = min(d, sdEffects(p));
    
    return d;
}

// Runtime collision response
if (sceneSDF(playerPos) < playerRadius) {
    // Collision detected
    vec3 normal = calcNormal(playerPos);
    // Apply impulse along normal
}
```

## Next Steps

Implementation will begin with the ray-marching renderer, followed by physics integration, and finally the full game logic port. All original features will be preserved while taking advantage of SDF's mathematical elegance and performance characteristics.
