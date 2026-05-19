# Dropfall Merge Strategy: dropfall-updated → main

**Target**: Integrate new game content, themes, audio systems, and visual improvements from `dropfall-updated` into the main `dropfall` branch while preserving TypeScript infrastructure, comprehensive tests, and SDF architecture.

**Direction**: JavaScript improvements flow upstream to TypeScript; TypeScript types remain the source of truth for future development.

---

## Executive Summary

The `dropfall-updated` branch contains significant new content that should be integrated:
- **3 new music themes** (Temple, Arctic, Inferno) with 25+ new instruments
- **Enhanced audio design** (collision/boost sounds per theme)
- **Hat system** with 5 character types + physics per hat
- **Shader-based arena materials** and theme-responsive skybox
- **Power-up sprite system** with weighted selection
- **Playable theme selection UI**

The merge is **low-conflict** because updated is simpler (JS-only) and complements main's infrastructure (TypeScript, tests, SDF). Main should remain the authoritative branch; integration flows one direction.

---

## Merge Dependency Chain

```
Phase 1: Content Inventory
    ↓
Phase 2: Core Code Integration  ← Most conflicts here
    ↓
Phase 3: SDF Integration (take from dropfall-updated)
    ↓
Phase 4: Asset/Config Merge
    ↓
Phase 5: Validation & Testing
```

**Critical Path**: Audio → Store (hat/powerUp state) → Player (hat physics) → Arena (themes/skybox) → UI

---

# Phase 1: Content Inventory

## Objective
Catalogue all new content in `dropfall-updated` that doesn't exist in main, and estimate merge complexity per file.

### 1.1 NEW FILES (only in dropfall-updated, must copy)

| File | Lines | Content | Merge Action |
|------|-------|---------|--------------|
| `src/shaders/tron-platform.js` | ~60 | Tron theme material | **COPY** to main `src/shaders/` |
| `src/shaders/tron-sky.js` | ~30 | Tron skybox | **COPY** |
| `src/shaders/temple-platform.js` | ~60 | Temple platform material | **COPY** |
| `src/shaders/temple-sky.js` | ~30 | Temple skybox | **COPY** |
| `src/shaders/arctic-platform.js` | ~60 | Arctic platform material | **COPY** |
| `src/shaders/arctic-sky.js` | ~30 | Arctic skybox | **COPY** |
| `src/shaders/inferno-platform.js` | ~60 | Inferno platform material | **COPY** |
| `src/shaders/inferno-sky.js` | ~30 | Inferno skybox | **COPY** |

**Subtotal**: 8 shader files (JavaScript material builders)

### 1.2 FILES WITH MAJOR ADDITIONS (require careful merge)

| File | Main Lines | Updated Lines | Type | Category | Priority |
|------|-----------|---------------|------|----------|----------|
| `src/audio.js` | ~800 | ~2200 | JavaScript | Audio | **CRITICAL** |
| `src/store.js` | ~300 | ~450 | JavaScript | State | **HIGH** |
| `src/main.js` | ~150 | ~250 | JavaScript | UI | **HIGH** |
| `src/entities/Player.js` | ~500 | ~650 | JavaScript | Physics | **HIGH** |
| `src/entities/Arena.js` | ~400 | ~600 | JavaScript | Rendering | **HIGH** |
| `index.html` | ~200 | ~350 | HTML | UI | **HIGH** |
| `src/style.css` | ~400 | ~600 | CSS | UI | **MEDIUM** |

**Subtotal**: 7 heavily modified files (3x+ growth in audio.js)

### 1.3 FILES IDENTICAL (no action needed)

- `src/input.js` → No changes
- `src/online.js` → No changes  
- `src/renderer.js` → No changes
- `src/ai/AIController.js` → No changes
- `src/sdf/*` → All identical
- `src/utils/math.js`, `textures.js` → No changes
- `src/entities/ParticleSystem.js`, `LightningSystem.js`, `ShockwaveSystem.js` → No changes
- `electron/preload.js` → Identical
- `server/server.js` → Identical
- `vite.config.js` → Functionally identical (main has extra comments)

### 1.4 FILES ONLY IN MAIN (preserve as-is)

These are main branch's TypeScript infrastructure and documentation:
- `src/**/*.ts` (all TypeScript files: store.ts, entities/*.ts, handlers/, systems/, types/)
- `tsconfig.json`, `.eslintrc.json`, `.eslintignore`
- Tests: `tests/*.test.{js,ts}`
- Docs: `SDF_ARCHITECTURE.md`, `SDF_IMPLEMENTATION_GUIDE.md`, `DELIVERY_SUMMARY.md`
- Configuration: TypeScript build chain, ESLint rules

### 1.5 NEW CONTENT SUMMARY

**New Themes**: Temple, Arctic, Inferno (3 new themes)
- Music: 3 complete theme soundscapes with 25+ new instruments
- Visuals: 6 new shader files (platform + sky per theme)
- Audio: Theme-specific collision sounds + boost sounds (6 variants each)
- UI: Hat selection dropdown, theme settings panel

**New Hat System**:
- Hat types: Santa, Cowboy, Afro, Crown, Dunce
- Physics: Per-hat collision shapes and weight adjustments
- Persistence: Hat selection saved to store

**Enhanced Power-up System**:
- Weighted selection (defined in store)
- Pre-assignment to bonus tiles
- Sprite generation (canvas-based with glow effect)

---

# Phase 2: Core Code Integration

## Objective
Merge logic changes while maintaining TypeScript type safety and test coverage.

### 2.1 PRIORITY ORDER (merge in this sequence to minimize conflicts)

#### Priority 1: Audio System (`src/audio.js`)
**Conflict Risk**: ⚠️ HIGH (file triples in size)

**Actions**:
1. **Preserve main's structure**: Don't refactor the JavaScript file
2. **Map new instruments**: Create wrapper functions for Temple/Arctic/Inferno instruments
   - Existing: `playCyberHiHat()`, `playBeachShaker()`, etc.
   - New: 25+ functions for 3 themes
3. **Update `playMusic()` function**: Add cases for new theme strings
   - Main recognizes: `'cyber'`, `'beach'`, `'cracked_stone'`
   - Add: `'temple'`, `'arctic'`, `'inferno'`, `'tron'` (6 cases total)
4. **Merge collision sounds**: Add theme-specific branches in `playCollisionSound(theme)`
5. **Merge boost sounds**: Update `setBoostSound()` with theme variants

**Integration Point**:
```javascript
// In playMusic(theme)
switch(theme) {
  case 'cyber': /* existing */ break;
  case 'beach': /* existing */ break;
  case 'temple': /* NEW - from dropfall-updated */ break;
  case 'arctic': /* NEW */ break;
  case 'inferno': /* NEW */ break;
  // ... etc
}
```

**Verification**: All theme cases must be present before proceeding to Phase 2.2

---

#### Priority 2: Store State (`src/store.js` + `src/store.ts`)

**Conflict Risk**: ⚠️ HIGH (two versions in main)

**Key additions from dropfall-updated**:
- `p1Hat`, `p2Hat` fields (string, hat type ID)
- `powerUpWeights` object (e.g., `{ ACCELERATION_BOOST: 1.0, SIZE_REDUCTION: 0.8 }`)
- Theme migration function (backward compatibility)

**Actions**:
1. **Update JavaScript version** (`src/store.js`):
   ```javascript
   // Add to DEFAULT_SETTINGS
   p1Hat: 'none',
   p2Hat: 'none',
   powerUpWeights: {
     ACCELERATION_BOOST: 1.0,
     SIZE_REDUCTION: 1.0,
     WEIGHT_INCREASE: 1.0,
     SPEED_BURST: 0.8,
     LIGHT_TOUCH: 0.9,
     // ... include all 8 power-ups
   }
   ```

2. **Update TypeScript version** (`src/store.ts`):
   ```typescript
   export interface GameSettings {
     // ... existing fields
     p1Hat: string;
     p2Hat: string;
     powerUpWeights: Record<string, number>;
   }
   ```

3. **Add theme defaults**: Map new themes to default audio/visual settings

**Verification**: Store can load/save hat selections without errors

**Note**: Keep both `.js` and `.ts` versions in sync; main should migrate to `.ts` over time

---

#### Priority 3: Player Entity (`src/entities/Player.js` + `src/entities/Player.ts`)

**Conflict Risk**: ⚠️ MEDIUM (hat system adds ~150 lines)

**New functionality in dropfall-updated**:
- Hat-specific physics (different mass/friction per hat)
- Hat rendering (mesh rotation/offset per hat type)
- Hat power-up pre-assignment

**Actions**:
1. **Define hat physics constants**:
   ```javascript
   const HAT_CONFIGS = {
     'santa': { mass: 1.0, friction: 0.4, offset: [0, 0.6, 0] },
     'cowboy': { mass: 1.05, friction: 0.35, offset: [0, 0.65, 0] },
     'afro': { mass: 0.95, friction: 0.5, offset: [0, 0.5, 0] },
     'crown': { mass: 1.1, friction: 0.3, offset: [0, 0.7, 0] },
     'dunce': { mass: 1.2, friction: 0.25, offset: [0, 0.8, 0] }
   }
   ```

2. **Update Player constructor**: Accept `hatType` as parameter
3. **Modify physics setup**: Use hat config for mass/friction
4. **Add hat mesh**: Render hat above player sphere (if not TypeScript-only)
5. **Update TypeScript version** (`Player.ts`): Mirror changes with type safety

**Verification**: Player can be created with any hat type; physics behaves per hat

---

#### Priority 4: Arena Entity (`src/entities/Arena.js` + `src/entities/Arena.ts`)

**Conflict Risk**: ⚠️⚠️ VERY HIGH (two completely different architectures)

**Main version**:
- Uses basic THREE.js materials (MeshStandardMaterial)
- No shaders, pure polygon rendering
- Portal + Bonus tile types

**dropfall-updated version**:
- Uses custom shader materials for platforms
- Theme-based skybox with animation
- Power-up sprite system
- No Portal tiles

**Decision Point** ⭐ **CRITICAL**:
- **Option A**: Adopt dropfall-updated's shader approach (more visual fidelity)
- **Option B**: Keep main's simpler material system (more maintainable, matches SDF philosophy)
- **Recommended**: **Option A** (user indicated preference for dropfall-updated visuals)

**Actions if Option A**:
1. **Copy shader material builder functions** from `dropfall-updated/src/shaders/`
2. **Add theme resolver**: `resolveThemeName(theme)` to normalize theme strings
3. **Create color system**: `getThemeColors(theme)` function
4. **Implement power-up sprites**: Use dropfall-updated's canvas-based sprite generation
5. **Implement skybox**: Use theme-based spherical skybox system
6. **Remove Portal tiles**: Deprecate PORTAL state, keep only NORMAL/ICE/WARNING/FALLING/BONUS

**File impacts**:
- `src/entities/Arena.js` → Replace material system with shader system
- `src/entities/Arena.ts` → Mirror changes with type safety
- `src/shaders/*.js` → Add 8 new shader files (from Phase 1)
- `src/utils/themeTextures.js` → Update with new theme support

**Verification**: Arena renders all 6 themes with correct shaders; skybox animates; power-ups display

---

#### Priority 5: Main UI (`src/main.js` + `index.html` + `src/style.css`)

**Conflict Risk**: ⚠️ MEDIUM (UI expansion but mostly additive)

**New UI elements from dropfall-updated**:
- Hat selection dropdowns (P1 Hat, P2 Hat)
- Theme selection dropdown (moved from preset buttons)
- Power-up weight sliders (advanced settings)
- Redesigned settings panel layout

**Actions**:
1. **Update HTML** (`index.html`):
   - Add hat selection dropdowns for both players
   - Add theme selection dropdown
   - Reorganize settings panel (group by category)

2. **Update CSS** (`src/style.css`):
   - Style hat selection UI
   - Update theme selector styling
   - Adjust settings panel layout for new controls

3. **Update JavaScript** (`src/main.js`):
   - Add hat change handlers
   - Update theme selection handler
   - Add power-up weight sliders (if implementing advanced settings)
   - Sync UI with store state on load

**Verification**: UI loads without errors; can change themes/hats; selections persist

---

### 2.2 Conflict Resolution Strategy

#### When merging large files (audio.js, Player.js, Arena.js):

1. **Use semantic merging** (not just diff-based): Understand what each section does
2. **Accept dropfall-updated's new sections**: Instrument definitions, effects, shaders
3. **Preserve main's advanced code**: TypeScript annotations, error handling, validation
4. **Test each function independently**: Use existing test suite after merge

#### Handle TypeScript dual-version issue:

```
src/
├── store.js          ← JavaScript version (keep for backward compat)
├── store.ts          ← TypeScript version (update with same changes)
├── entities/
│   ├── Player.js     ← JavaScript version (legacy)
│   ├── Player.ts     ← TypeScript version (primary going forward)
│   ├── Arena.js      ← JavaScript version (legacy)
│   └── Arena.ts      ← TypeScript version (primary going forward)
```

**Rule**: After merge, keep .js and .ts versions synchronized. Long-term goal: migrate entirely to .ts.

---

# Phase 3: SDF Integration

## Objective
Integrate SDF system from dropfall-updated (as user indicated preference).

### 3.1 Decision: Which SDF version to use?

**Main branch SDF state**:
- Complete SDF ray-marching implementation in `src/sdf/`
- Full documented architecture
- Advanced effects system (lightning, shockwave)

**dropfall-updated SDF state**:
- Identical SDF implementation (verified in merge analysis)
- No changes or improvements

**Decision**: **Use main's SDF as-is** (no changes needed)

### 3.2 Verification Steps

1. **Confirm SDF files identical**:
   ```bash
   diff -r src/sdf/ dropfall-updated/src/sdf/
   # Should show: "No differences encountered" or only whitespace diffs
   ```

2. **Test SDF rendering**: Run main game in SDF mode, verify it works
   ```bash
   npm run dev  # Assuming default build uses SDF
   ```

3. **Document SDF status**: Note that SDF remains unchanged in merge

### 3.3 Integration Point

SDF system is **orthogonal** to Phase 2 changes:
- New themes (audio/visuals) work independently of SDF vs. polygon rendering
- Power-up system works in both rendering modes
- Hat system is purely gameplay, rendering-agnostic

**No changes needed** for SDF to work with merged content.

---

# Phase 4: Asset & Config Merge

## Objective
Integrate configuration files, build system, and dependencies while preserving quality gates.

### 4.1 package.json Reconciliation

**Main branch dependencies** (superset):
```json
{
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/three": "^0.183.1",
    "eslint": "^8.57.0",
    "vitest": "^4.1.2",
    // ... TypeScript toolchain
  },
  "dependencies": {
    "zod": "^4.3.6"  // ⚠️ dropfall-updated MISSING this
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.js"
  }
}
```

**dropfall-updated dependencies** (smaller):
```json
{
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^4.1.2"
    // Minimal set, no TypeScript tooling
  }
}
```

**Merge action**:
- **Keep main's package.json**: It's the superset
- **Verify all dropfall-updated's dependencies are present in main**: They are (Vite, Vitest)
- **Check for zod usage**: Verify main's codebase actually uses zod (it does, in validation/)
- **Action**: No changes to package.json needed; main is already correct

### 4.2 Build Configuration

**vite.config.js**:
- Main and dropfall-updated are functionally identical
- Main has extra comments
- **Action**: Keep main's version (comments are documentation)

**vitest.config.js**:
- **Main**: Includes `.js` and `.ts` test files: `tests/**/*.test.{js,ts}`
- **dropfall-updated**: Only `.js` files: `tests/**/*.test.js`
- **Action**: Keep main's version (it covers all tests)

### 4.3 TypeScript Configuration

**tsconfig.json**:
- Only in main branch
- Required for TypeScript files to compile
- **Action**: Keep as-is (dropfall-updated doesn't have TypeScript files)

### 4.4 ESLint Configuration

**Files in main only**:
- `.eslintrc.json`
- `.eslintignore`

**Purpose**: Enforce code quality on .ts and .js files

**Action**: Keep main's config; it encompasses all files

---

# Phase 5: Validation & Testing

## Objective
Verify all systems work correctly after merge; identify and fix any integration issues.

### 5.1 Pre-Merge Checklist

**Before starting any merges**, establish baseline:

```bash
# On main branch:
npm install
npm run type-check      # Verify TypeScript compiles
npm run lint            # Verify ESLint passes
npm run test            # Run all tests
npm run dev             # Start dev server

# Expected: All pass, game runs
```

### 5.2 Phase-by-Phase Testing

After each phase (2.1 through 4.4), run:

```bash
# After Phase 2.1 (Audio):
npm run dev
# Test: All themes play music correctly, collision/boost sounds work

# After Phase 2.2 (Store):
npm run dev
# Test: Hat selection saves/loads, power-up weights affect gameplay

# After Phase 2.3 (Player):
npm run dev
# Test: Player moves with correct physics per hat type

# After Phase 2.4 (Arena):
npm run dev
# Test: Arena renders with shaders, skybox animates, power-ups display

# After Phase 2.5 (UI):
npm run dev
# Test: Theme/hat dropdowns work, UI syncs with game state

# After Phase 3 (SDF):
npm run dev  # (if defaulting to SDF)
# Test: SDF rendering still works, new content visible

# After Phase 4:
npm run type-check
npm run lint
npm run test
# All must pass
```

### 5.3 Integration Test Plan

Create UAT script (`tests/merge-validation.test.ts`):

```typescript
describe('Merge Validation: dropfall-updated → main', () => {
  
  // Test Theme System
  test('All 6 themes load without errors', () => {
    // Load each theme, verify music plays
    // Verify Arena renders with correct shader
    // Verify skybox loads
  });

  // Test Hat System
  test('All 5 hats have correct physics', () => {
    // Create player with each hat type
    // Verify mass/friction values
    // Verify rendering offset
  });

  // Test Audio System
  test('Audio system supports all instruments', () => {
    // Play one instrument from each theme
    // Verify no errors
  });

  // Test Power-up System
  test('Power-up weighted selection works', () => {
    // Load power-up weights from store
    // Select 100 power-ups, verify distribution
  });

  // Test SDF Compatibility
  test('New content works in SDF mode', () => {
    // Switch to SDF renderer
    // Load new themes
    // Verify visual consistency
  });

  // Test TypeScript Build
  test('TypeScript compilation succeeds', () => {
    // Run tsc --noEmit
    // No errors expected
  });
});
```

### 5.4 Manual Testing Workflow

1. **Theme Testing**:
   - Start game in main branch (baseline)
   - Switch to each theme; verify music, sounds, visuals
   - Note any crashes or warnings

2. **Hat Testing**:
   - Set P1 Hat to each type (Santa, Cowboy, Afro, Crown, Dunce)
   - Play short game, verify physics feel different
   - Verify hat persists across game restart

3. **Feature Testing**:
   - Use power-ups, verify effects work
   - Use boost, verify sound correct per theme
   - Take collision damage, verify sound correct per theme

4. **Regression Testing**:
   - Existing features still work (original gameplay)
   - Existing themes still work (Cyber, Beach, Stone)
   - Online multiplayer (if applicable)

### 5.5 Known Issues & Mitigations

| Issue | Symptom | Mitigation |
|-------|---------|-----------|
| Portal tiles removed | `getPortalTiles()` undefined | Search codebase for PORTAL; remove references |
| Dual store versions | Type mismatch | Keep .js and .ts synchronized |
| Theme string mapping | "tron" vs "cyber" | Use `resolveThemeName()` to normalize |
| Shader compatibility | Graphic glitches | Test all themes in both polygon and SDF modes |
| Hat mesh rendering | Not showing | Ensure hat offset/scale applied in Player |

### 5.6 Rollback Plan

If critical issues arise:

1. **During Phase 2**: Revert individual files with git
   ```bash
   git checkout main -- src/audio.js  # Revert audio merge
   ```

2. **During Phase 4**: Revert config files
   ```bash
   git checkout main -- package.json  # Revert deps
   ```

3. **After merge complete**: Create new branch from pre-merge state
   ```bash
   git branch merge-rollback HEAD~1
   ```

---

# Phase 6: Merge Execution Workflow

## Step-by-Step Procedure

### Pre-Merge (Setup)

```bash
cd /home/paupl/Workbench/dropfall

# Ensure clean state on main
git status  # Should show no uncommitted changes

# Create isolated merge branch
git checkout -b merge/updated-integration

# Verify starting point
npm run test  # Baseline tests pass
```

### Phase 1: Content Inventory

```bash
# Compare directories
diff -r src/shaders/ dropfall-updated/src/shaders/
# Identify new shader files to copy

# Verify file sizes
wc -l src/audio.js dropfall-updated/src/audio.js
# Main: ~800, Updated: ~2200 → expect 3x merge
```

### Phase 2.1: Audio Integration

```bash
# Open both audio files in editor
# Keep main's structure, insert new theme cases into playMusic()
# Copy instrument definitions section from dropfall-updated
# Update collision/boost sound handlers

# Test
npm run dev  # Try each theme
```

### Phase 2.2: Store State

```bash
# Update store.js with hat/powerUp fields
# Update store.ts with same changes
# Run tests to verify state persistence
```

### Phase 2.3-2.5: Entity & UI

```bash
# Merge Player.js/ts → add hat system
# Merge Arena.js/ts → integrate shaders
# Merge UI files (html/css/main.js)
# After each: npm run dev, manual test
```

### Phase 3: SDF Verification

```bash
# Verify SDF files unchanged
diff -r src/sdf/ dropfall-updated/src/sdf/

# Test SDF mode still works
npm run dev
# [If SDF mode available, test it]
```

### Phase 4: Config Merge

```bash
# Review and commit package.json, configs
# No changes; confirm main's versions are kept
```

### Phase 5: Comprehensive Testing

```bash
# Full test suite
npm run type-check
npm run lint
npm run test

# Manual UAT
npm run dev
# [Test all features per Section 5.4]
```

### Final: Merge to Main

```bash
# On merge branch, commit all changes
git add -A
git commit -m "Merge: Integrate dropfall-updated themes, audio, hats, and UI

- Add 3 new music themes (Temple, Arctic, Inferno) with 25+ instruments
- Add 5 hat types with theme-specific physics
- Integrate shader-based Arena rendering with skybox system
- Add power-up sprite system with weighted selection
- Update UI with hat/theme selection dropdowns
- Maintain TypeScript infrastructure and test suite
- Preserve SDF system as-is

Merge direction: dropfall-updated → main
Conflicts resolved: [list of files manually merged]
All tests passing: npm run test, npm run type-check, npm run lint"

# Merge back to main
git checkout main
git merge merge/updated-integration

# Verify on main
npm run test
npm run dev
```

---

# Edge Cases & Special Considerations

### Case 1: TypeScript vs JavaScript Proliferation

**Problem**: Both `Player.js` and `Player.ts` need the same changes.

**Solution**: 
- Merge both files in parallel
- Create GitHub issue to "Deprecate .js versions after 1.0 release"
- Add comment in .js files: `// DEPRECATED: Use .ts version for new features`

### Case 2: Theme String Normalization

**Problem**: dropfall-updated uses "tron", main uses "cyber".

**Solution**:
- Add theme resolver:
  ```javascript
  function resolveThemeName(theme) {
    const mapping = { 'cyber': 'cyber', 'tron': 'cyber', /* ... */ };
    return mapping[theme] || 'cyber';
  }
  ```

### Case 3: Power-up Weights Not Applied

**Problem**: Store has weights, but gameplay doesn't use them.

**Solution**:
- In Arena/Game engine, when selecting bonus tile power-up:
  ```javascript
  const weights = gameSettings.powerUpWeights;
  const weighted = selectWeightedPowerUp(weights);
  ```

### Case 4: Hat Physics Doesn't Affect Gameplay

**Problem**: Hats have config but don't change player behavior.

**Solution**:
- In Player constructor:
  ```javascript
  const hatConfig = HAT_CONFIGS[hatType] || HAT_CONFIGS['none'];
  this.rigidBody.setMass(hatConfig.mass);
  this.rigidBody.setFriction(hatConfig.friction);
  ```

### Case 5: Portal Tiles Cause Errors After Removal

**Problem**: Main code references Portal tiles, dropfall-updated doesn't have them.

**Solution**:
- Search for `PORTAL` and `portal` in main
- Remove or stub out references:
  ```javascript
  // OLD: if (tile.state === TILE_STATE.PORTAL) triggerPortal();
  // NEW: (removed - PORTAL tiles no longer in use)
  ```

---

# Sign-Off Checklist

Before declaring merge complete:

- [ ] All phase 1 content accounted for (8 shaders, 7 major files)
- [ ] Audio system supports all 6 themes
- [ ] Store can save/load hat selections and power-up weights
- [ ] Players render with correct hat physics
- [ ] Arena renders with theme-specific shaders and animated skybox
- [ ] UI allows theme/hat selection
- [ ] SDF system verified unchanged and functional
- [ ] package.json reconciled (main's version kept)
- [ ] TypeScript compilation succeeds: `npm run type-check` passes
- [ ] ESLint passes: `npm run lint` passes
- [ ] All tests pass: `npm run test` passes
- [ ] Manual UAT complete: All features tested per Section 5.4
- [ ] No regressions: Existing gameplay works identically
- [ ] Merge branch cleaned up (force-pushed or deleted)
- [ ] Merge commit message documents changes and rationale

---

# Appendix: File Merge Reference Matrix

| Phase | File | Source | Action | Conflict Risk | Test Point |
|-------|------|--------|--------|---|---|
| 2.1 | src/audio.js | Updated → Main | Insert new theme cases | HIGH | Music plays all themes |
| 2.2 | src/store.js | Updated → Main | Add hat/powerUp fields | HIGH | Hat persists |
| 2.2 | src/store.ts | Updated → Main | Mirror store.js | HIGH | Type-check passes |
| 2.3 | src/entities/Player.js | Updated → Main | Add hat system | MEDIUM | Hat physics works |
| 2.3 | src/entities/Player.ts | Updated → Main | Mirror Player.js | MEDIUM | Player spawns |
| 2.4 | src/entities/Arena.js | Updated → Main | Replace materials with shaders | VERY HIGH | Shaders render |
| 2.4 | src/entities/Arena.ts | Updated → Main | Mirror Arena.js | VERY HIGH | Arena initializes |
| 2.5 | index.html | Updated → Main | Add hat/theme dropdowns | MEDIUM | UI loads |
| 2.5 | src/style.css | Updated → Main | Update settings panel styling | LOW | UI styled correctly |
| 2.5 | src/main.js | Updated → Main | Add hat/theme handlers | MEDIUM | Selections sync |
| 1 | src/shaders/*.js | Updated → Main | Copy 8 new files | NONE | Import succeeds |
| 3 | src/sdf/* | Main unchanged | Verify only | NONE | SDF still works |
| 4 | package.json | Main unchanged | Keep as-is | NONE | npm install works |
| 4 | vitest.config.js | Main version | Keep existing | NONE | Tests find .ts files |
| 4 | tsconfig.json | Main unchanged | Keep as-is | NONE | TypeScript compiles |

---

## Document Version

- **Created**: 2026-03-31
- **Status**: Ready for Implementation
- **Merge Type**: Strategic Content Integration (low-risk, high-value)
- **Estimated Duration**: 2-4 hours (with testing)
- **Next Step**: Execute Phase 1 (content inventory) to confirm file locations

---
