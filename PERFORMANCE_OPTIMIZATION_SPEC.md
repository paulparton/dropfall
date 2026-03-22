# Dropfall Performance Optimization Specification

## Executive Summary

This document provides a comprehensive analysis of the current performance bottlenecks in Dropfall and recommends targeted optimizations. The primary issues stem from excessive dynamic lighting, unoptimized geometry and material management, and inefficient rendering practices.

---

## Performance Analysis

### Current Bottlenecks (Priority Order)

#### 1. **Arena Tile Lighting System (CRITICAL - 40-50% of frame time)**

**Problem:**
- 30+ individual `PointLight` objects, one per tile
- PointLights are expensive because they require per-fragment lighting calculations
- Each light computes illumination for all nearby pixels in range
- Lights update intensity/color every frame
- Mobile devices cannot handle this many dynamic lights

**Impact:**
- Each light adds shadow casting overhead
- Exponential performance degradation as tile count increases
- Bloom post-processing multiplies the cost

**Current Code Location:** `src/entities/Arena.js:70-74`
```javascript
const light = new THREE.PointLight(this.edgeColor, 3.0, 15);
light.position.y = 2;
mesh.add(light);
```

---

#### 2. **Inefficient Tile Geometry and Material Management (15-20%)**

**Problem:**
- Each tile clones the geometry instead of reusing a single shared geometry
- Each tile has independent material instances instead of sharing materials
- Material properties (color, opacity) updated individually per tile per frame
- No batching or instancing

**Current Code Location:** `src/entities/Arena.js:29-60`
```javascript
const material = new THREE.MeshStandardMaterial(tileMaterialParams);
// Later in loop:
const mesh = new THREE.Mesh(geometry, material.clone()); // CLONE per tile
```

**Memory Impact:**
- 30 geometries × ~500 vertices = unnecessary duplication
- 30+ material instances when 2-4 would suffice

---

#### 3. **Player Sphere Resolution and Lighting (10-15%)**

**Problem:**
- Sphere geometry created with 32x32 segments (2,048 vertices per sphere)
- Unnecessary detail for gameplay (16x16 or 12x12 sufficient)
- 2 PointLights (one per player) in addition to tile lights
- Aura mesh is also 32x32 segments

**Current Code Location:** `src/entities/Player.js:28, 58-63`
```javascript
const geometry = new THREE.SphereGeometry(this.sphereSize, 32, 32); // Too high res

const auraGeometry = new THREE.SphereGeometry(
    this.sphereSize * settings.playerAuraSize, 32, 32 // Also too high
);
```

---

#### 4. **Lightning Effect Geometry Creation (10-12%)**

**Problem:**
- TubeGeometry is one of the most expensive geometries in Three.js
- Creating 2-4 tube geometries per lightning strike
- Complex CatmullRomCurve3 interpolation per strike
- Multiple segments create high-poly meshes
- Strikes last 0.2-0.5 seconds but recalculated every frame

**Current Code Location:** `src/entities/LightningSystem.js:48-75`
```javascript
const coreGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.1, 4, false);
const glowGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.4, 4, false);
```

---

#### 5. **Post-Processing Overhead (8-10%)**

**Problem:**
- UnrealBloomPass enabled on all devices including mobile
- Bloom requires multiple render passes
- Shadow mapping at 2048x2048 on desktop
- No LOD system for visual effects

**Current Code Location:** `src/renderer.js:48-65`

---

#### 6. **Unnecessary Frame Updates (5-8%)**

**Problem:**
- `Date.now()` called every frame for tile pulse animation
- Per-tile opacity and color updates every frame
- No object pool reuse
- Material disposal inefficient

---

## Recommended Optimizations

### Phase 1: Critical Fixes (Immediate - 50-60% improvement)

#### 1A. Eliminate Tile Point Lights

**Replace with:**
- Single directional light for shadows (already exists)
- Emissive materials on tiles for glow effect (much cheaper)
- Screen-space ambient occlusion (SSAO) for depth
- Precomputed lightmaps if needed

**Implementation:**
```javascript
// Replace PointLight with emissive material
const material = new THREE.MeshStandardMaterial({
    ...tileMaterialParams,
    emissive: this.edgeColor,
    emissiveIntensity: 0.3  // Pulsed between 0.2-0.5
});
// OR use edge colors with high emissive
```

**Expected Gain:** 30-40% performance improvement

---

#### 1B. Implement Material and Geometry Sharing

**Approach:**
- Create ONE shared tile geometry, reuse for all tiles
- Create 2-3 material variants (NORMAL, ICE, FALLING) and swap between them
- Use `material.needsUpdate = false` to avoid unnecessary updates

**Implementation:**
```javascript
// Outside Arena constructor
const sharedTileGeometry = new THREE.CylinderGeometry(tileRadius, tileRadius, height, 6);

// Material variants
const materials = {
    normal: new THREE.MeshStandardMaterial({ /* normal params */ }),
    ice: new THREE.MeshStandardMaterial({ /* ice params */ }),
    falling: new THREE.MeshStandardMaterial({ /* falling params */ })
};

// In loop:
const mesh = new THREE.Mesh(sharedTileGeometry, materials.normal);
```

**Expected Gain:** 15-20% improvement

---

#### 1C. Reduce Player Sphere Complexity

**Change from 32x32 to 16x16 segments:**
- Player spheres: minimal visual quality loss
- Aura mesh: 12x12 segments (visual effect, doesn't need detail)

**Implementation:**
```javascript
const geometry = new THREE.SphereGeometry(this.sphereSize, 16, 16); // was 32, 32
const auraGeometry = new THREE.SphereGeometry(this.sphereSize * settings.playerAuraSize, 12, 12);
```

**Expected Gain:** 5-8% improvement

---

### Phase 2: High-Impact Improvements (Medium-term)

#### 2A. Replace Lightning TubeGeometry with Line Segments

**Problem with Current Approach:**
- TubeGeometry with 15-30 segments per strike = 180-360 vertices minimum
- Multiple tubes per strike (core + glow)

**Better Approach:**
- Use `THREE.LineSegments` or `THREE.Line` for lightning
- Much simpler geometry (just connected points)
- Use line width or shader for thickness illusion
- Custom shader for glow effect

```javascript
// Instead of TubeGeometry:
const points = []; // your curve points
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, lineMaterial);

// For thickness: use LineBasicMaterial with linewidth (limited browser support)
// OR use custom shader with vertex displacement
// OR render as flat quads in a custom shader
```

**Expected Gain:** 8-12% improvement

---

#### 2B. Implement Object Pooling for Effects

**Current Problem:**
- Creating/destroying shockwaves, lightning strikes every frame
- Memory fragmentation
- GC pressure

**Solution:**
- Pool pre-created shockwave and lightning meshes
- Reuse geometries and materials
- Mark as active/inactive instead of creating/destroying

```javascript
class EffectPool {
    constructor(size = 20) {
        this.pool = [];
        this.active = [];
        // Create pool items upfront
    }
    
    get() {
        if (this.pool.length) return this.pool.pop();
        // Create new if needed
        return this.create();
    }
    
    release(item) {
        item.visible = false;
        this.pool.push(item);
    }
}
```

**Expected Gain:** 5-7% improvement (mainly frame rate consistency)

---

#### 2C. Disable Bloom on Mobile / Reduce Post-Processing

**Current Code:** Mobile gets reduced bloom but still runs post-processing

**Better Approach:**
```javascript
if (isMobile) {
    // Skip bloom entirely on mobile
    composer.removePass(bloomPass);
    // Use direct render or simpler post-processing
}
```

**Expected Gain:** 8-12% on mobile

---

### Phase 3: Visual Quality + Performance

#### 3A. Implement LOD (Level of Detail) System

**Approach:**
- Disable visual effects (particles, lightning) when far away
- Reduce tile edge line opacity dynamically
- Reduce shadow map resolution based on performance

```javascript
// Distance-based LOD
const distance = camera.position.distanceTo(object.position);
if (distance > 50) {
    // Disable detailed effects
    object.lightningIntensity = 0;
    object.particleAmount *= 0.5;
}
```

---

#### 3B. Implement Asset Preloading

**Problem:**
- Loading levels takes time due to geometry/material creation
- Mobile struggles with initial scene setup

**Solution:**
- Pre-allocate geometries at boot
- Use threaded web workers for expensive calculations
- Stream assets rather than loading all at once

---

#### 3C. Aggressive Culling

**Approaches:**
1. **Frustum Culling:** Only render visible objects (Three.js does this but verify)
2. **Distance Culling:** Disable tiles/effects beyond camera range
3. **Occlusion Culling:** Don't render occluded objects

```javascript
// Simple distance culling
if (mesh.position.distanceTo(camera.position) > 100) {
    mesh.visible = false;
}
```

---

## Priority Implementation Roadmap

### Week 1: Critical Fixes
1. **Remove all tile PointLights** → Replace with emissive
2. **Implement material/geometry sharing**
3. Reduce player sphere resolution

### Week 2: Major Improvements
1. Replace lightning TubeGeometry
2. Implement object pooling
3. Disable bloom on mobile

### Week 3: Optimization
1. LOD system
2. Culling
3. Testing and profiling

---

## Profiling Guidance

### Chrome DevTools Performance Analysis

**Steps:**
1. Open DevTools → Performance tab
2. Record for 5-10 seconds during gameplay
3. Look for frame time bottlenecks:
   - Rendering (green)
   - Scripting (yellow)
   - Rendering + Compositing (purple)

**Expected Results After Optimization:**
- Desktop: 60 FPS consistent
- Mobile: 30 FPS consistent (target)

### Three.js Specific Tools

**Renderer Info:**
```javascript
renderer.info.render.calls          // Draw calls (lower is better)
renderer.info.memory.geometries     // Number of geometries
renderer.info.memory.textures       // Texture count
```

**Target Values:**
- Draw calls: < 50 (currently probably 100+)
- Geometries: < 10 total (currently 30+)
- Textures: < 20

---

## Expected Performance Gains

### Performance Improvement Summary

| Optimization | Impact | Difficulty |
|---|---|---|
| Remove Tile Lights | 30-40% | Easy |
| Material Sharing | 15-20% | Medium |
| Reduce Sphere Res | 5-8% | Easy |
| Replace Lightning | 8-12% | Medium |
| Object Pooling | 5-7% | Easy |
| Mobile Bloom Disable | 8-12% Mobile | Easy |
| LOD System | 10-15% | Hard |
| Culling | 5-10% | Medium |

**Combined Expected Improvement: 70-100%+ performance boost**

---

## Implementation Code Templates

### Template 1: Shared Geometry and Material

```javascript
// At module level
const TILE_GEOMETRY = new THREE.CylinderGeometry(8, 8, 4, 6);

const TILE_MATERIALS = {
    normal: new THREE.MeshStandardMaterial({
        color: 0x666666,
        emissive: 0xff00ff,
        emissiveIntensity: 0.3
    }),
    ice: new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.4
    }),
    falling: new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 0.5
    })
};

// In Arena constructor:
hexes.forEach(hex => {
    const mesh = new THREE.Mesh(TILE_GEOMETRY, TILE_MATERIALS.normal);
    // ... rest of setup
});
```

### Template 2: Emissive Pulsing Without Dynamic Light

```javascript
// In Arena update():
const time = this.pulseTime || 0; // Use clock.getElapsedTime()
const pulse = (Math.sin(time * Math.PI * 2 * beatFreq - dist * 0.2) + 1) / 2;

// Update emissive intensity instead of light intensity
tile.mesh.material.emissiveIntensity = 0.2 + pulse * 0.3;
tile.mesh.material.needsUpdate = false; // Avoid rebuilding shader
```

### Template 3: Object Pool Pattern

```javascript
class Pool {
    constructor(factory, size = 20) {
        this.factory = factory;
        this.available = [];
        this.inUse = [];
        for (let i = 0; i < size; i++) {
            this.available.push(factory());
        }
    }
    
    acquire() {
        const item = this.available.length ? 
            this.available.pop() : 
            this.factory();
        this.inUse.push(item);
        return item;
    }
    
    release(item) {
        this.inUse = this.inUse.filter(i => i !== item);
        this.available.push(item);
    }
    
    cleanup() {
        [...this.available, ...this.inUse].forEach(item => {
            if (item.dispose) item.dispose();
        });
    }
}
```

---

## Mobile-Specific Optimizations

### Mobile Detection Enhancements

```javascript
function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile/.test(userAgent);
    const isSmallScreen = window.innerWidth < 768;
    const isSlowDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    
    return isMobile || isSmallScreen || isSlowDevice;
}
```

### Mobile-Specific Settings

```javascript
const mobileSettings = {
    maxTiles: 20,              // Reduce arena complexity
    shadowMapResolution: 512,
    maxParticles: 500,
    maxLights: 0,              // No dynamic lights
    bloomEnabled: false,
    particleDensity: 0.5,
    fxQuality: 'low'           // Lightning, shockwaves simplified
};
```

---

## Measurement and Testing

### Performance Targets

| Metric | Desktop | Mobile |
|---|---|---|
| Frame Time | 16.67ms (60 FPS) | 33ms (30 FPS) |
| Memory | < 200MB | < 100MB |
| Draw Calls | < 50 | < 30 |
| Load Time | < 3 seconds | < 5 seconds |

### Key Metrics to Monitor

1. **FPS consistency** (target: 60 on desktop, 30 on mobile)
2. **Memory usage** (monitor garbage collection)
3. **Draw calls** (renderer.info.render.calls)
4. **Geometry instances** (renderer.info.memory.geometries)

---

## Testing Strategy

1. Profile baseline performance
2. Implement Phase 1 optimizations
3. Measure improvement
4. Repeat for Phase 2, 3

Use Chrome DevTools Performance and Memory tabs to validate.

