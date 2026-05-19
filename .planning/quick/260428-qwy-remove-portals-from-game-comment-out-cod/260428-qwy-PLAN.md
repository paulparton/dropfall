---
phase: 260428-qwy-remove-portals-from-game-comment-out-cod
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/store.ts
  - src/entities/Arena.ts
  - src/sdf/ray-march.glsl
  - src/sdf/main.js
  - src/sdf/game-engine.js
autonomous: true
requirements: []

must_haves:
  truths:
    - "Portal tiles no longer spawn during gameplay"
    - "Portal config properties remain in code but commented out"
    - "Portal rendering logic preserved but disabled"
  artifacts:
    - path: "src/store.ts"
      provides: "Commented portal config (portalRate, portalCooldown)"
    - path: "src/entities/Arena.ts"
      provides: "Commented portal timer, state handling, and trigger logic"
    - path: "src/sdf/ray-march.glsl"
      provides: "Commented sdPortals() function and usage"
    - path: "src/sdf/main.js"
      provides: "Commented portal-rate uniform mapping"
    - path: "src/sdf/game-engine.js"
      provides: "Commented portal timer and trigger methods"
  key_links:
    - from: "src/entities/Arena.ts"
      to: "src/store.ts"
      via: "settings.portalRate reference"
      pattern: "settings\\.portalRate"
---

<objective>
Remove portal functionality from the game by commenting out all portal-related code while preserving it for potential future reintroduction.

Purpose: Simplify gameplay by removing the portal mechanic without permanently deleting the implementation.
Output: All portal code commented out with clear preservation markers.
</objective>

<execution_context>
@~/.copilot/get-shit-done/workflows/execute-plan.md
@~/.copilot/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Portal functionality exists across multiple files:
- Config properties in store.ts (portalRate, portalCooldown)
- Arena entity logic for spawning and managing portal tiles
- SDF shader code for rendering portal visuals
- Game engine timer and trigger logic

The 'PORTAL' tile state should remain in the TileState type (as it's used in level editor data structures), but the runtime logic that spawns and handles portals should be disabled.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Comment out portal config and store properties</name>
  <files>src/store.ts</files>
  <action>
Comment out portal-related properties in the GameSettings interface and default settings object:
- portalRate: number (line 30)
- portalCooldown: number (line 31)  
- Default values portalRate: 8.0 and portalCooldown: 2.0 (lines 239-240)

Use block comments with clear preservation markers like:
/* PORTAL FEATURE - COMMENTED OUT FOR POTENTIAL FUTURE USE
  portalRate: number;
  portalCooldown: number;
*/

Keep the TypeScript interface valid by ensuring proper formatting.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -i "error" || echo "Build successful"</automated>
  </verify>
  <done>Portal config properties commented out, TypeScript compiles without errors</done>
</task>

<task type="auto">
  <name>Task 2: Comment out portal logic in Arena and game engine</name>
  <files>src/entities/Arena.ts, src/sdf/game-engine.js</files>
  <action>
Comment out portal spawning and handling logic in both files:

**In src/entities/Arena.ts:**
- portalTimer property declaration (line 128)
- Portal timer increment in update() (line 308)
- Portal rate retrieval (line 317)
- Portal trigger condition and call (lines 332-336: "if (this.portalTimer >= portalRate) {...}")
- Portal state material assignment (lines 358-359)
- triggerPortal() method (entire method)
- Portal case in material switch statement (lines 224-225)

**In src/sdf/game-engine.js:**
- portalTimer property (line 30)
- Portal timer increment (line 297)
- Portal trigger condition block (lines 311-313)
- triggerRandomPortalTile() method (lines 355-370)
- Portal timer reset in game reset (line 542)

Leave the 'PORTAL' value in the TileState type enum UNCOMMENTED (line 20 in Arena.ts) since it's referenced by level editor data structures. Comment only the runtime logic.

Use clear block comment markers: /* PORTAL FEATURE - DISABLED */ for larger blocks.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -i "error" || echo "Build successful" && npm test 2>&1 | grep -E "(PASS|FAIL)" | head -5</automated>
  </verify>
  <done>All portal spawning and handling logic commented out, game still builds and runs</done>
</task>

<task type="auto">
  <name>Task 3: Comment out portal rendering in shaders</name>
  <files>src/sdf/ray-march.glsl, src/sdf/main.js</files>
  <action>
Comment out portal rendering code:

**In src/sdf/ray-march.glsl:**
- sdPortals() function definition (lines 131-147)
- sdPortals() call in scene composition (line 188: "d = opUnion(d, sdPortals(p));")
- Portal tile state check in material color (line 328: "if (tileState.g > 0.5) { // Portal")

For GLSL, use // line comments for each line since block comments can be problematic in shaders.
Add a clear header: // PORTAL FEATURE - DISABLED

**In src/sdf/main.js:**
- portal-rate uniform mapping (line 286: "'portal-rate': 'portalRate',")

Use // line comments with clear markers.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -i "error" || echo "Build successful"</automated>
  </verify>
  <done>Portal shader rendering code commented out, shaders compile successfully</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. Run `npm run build` - should complete without errors
2. Run `npm test` - existing tests should still pass
3. Start the game - no portal tiles should spawn during gameplay
4. Code search for "portal" confirms all functional code is commented, only type definitions remain
</verification>

<success_criteria>
- Build completes successfully with no TypeScript or shader compilation errors
- Game runs without spawning portal tiles
- Portal-related code remains in source files as commented blocks with preservation markers
- TileState type still includes 'PORTAL' for level editor compatibility
- All commented code includes clear markers indicating it's disabled for future potential use
</success_criteria>

<output>
After completion, create `.planning/quick/260428-qwy-remove-portals-from-game-comment-out-cod/260428-qwy-SUMMARY.md`
</output>
