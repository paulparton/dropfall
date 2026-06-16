---
phase: quick-ar-mode
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/store.js
  - src/vr/VRSession.js
  - src/vr/VRCamera.js
  - src/renderer.js
  - src/main.js
  - index.html
autonomous: false
requirements: []
must_haves:
  truths:
    - "User can enter AR mode on Quest 2 (passthrough visible behind arena)"
    - "Roomscale AR places the arena on the real floor (like VR but see-through)"
    - "Tabletop AR places the arena at a configurable height above the floor (table/surface height)"
    - "Arena responds to VR controller input the same in AR as in VR"
    - "AR mode is selectable from the settings panel"
  artifacts:
    - path: "src/vr/VRSession.js"
      provides: "AR session initiation and mode detection"
      exports: ["initAR", "isInAR", "getXRSessionMode"]
    - path: "src/vr/VRCamera.js"
      provides: "Tabletop AR height offset in container positioning"
    - path: "src/store.js"
      provides: "AR settings (arMode, arModeType, arHeight)"
  key_links:
    - from: "main.js init"
      to: "VRSession.initAR"
      via: "Creates AR button alongside VR button"
    - from: "VRCamera.applyVRScale"
      to: "store arModeType/arHeight"
      via: "Reads store to position container at floor or table height"
    - from: "renderer.js initRenderer"
      to: "WebGLRenderer alpha:true"
      via: "Enables transparent AR background"
---

<objective>
Add AR mode support to the existing VR system — roomscale (arena on floor) and tabletop (arena at configurable surface height) AR modes for Meta Quest 2.

**Purpose:** Allow Quest 2 users to play Dropfall in passthrough AR mode, seeing the real environment behind the game arena.
**Output:** AR mode toggle + AR session button + camera positioning for roomscale/tabletop.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/store.js
@src/vr/VRSession.js
@src/vr/VRCamera.js
@src/renderer.js
@src/main.js
@index.html

<interfaces>
Current VRButton approach (src/vr/VRSession.js):
```js
import { VRButton } from 'three/addons/webxr/VRButton.js';
export function initVR(renderer) {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    // ...event listeners for sessionstart/sessionend
    return VRButton.createButton(renderer);
}
export function isInVR() { return renderer.xr.isPresenting; }
export function getXRSession() { return renderer.xr.getSession(); }
```

ARButton is available at `three/addons/webxr/ARButton.js` — same pattern but requests `immersive-ar` session.

Current camera rig (src/vr/VRCamera.js):
```js
// Container at (0, 0, 0) in local-floor space — arena appears on floor
vrContainer.position.set(0, 0, 0);
vrContainer.scale.setScalar(vrScale / ARENA_WORLD_SIZE);
```

Current renderer (src/renderer.js) — no `alpha: true`, will add it.

Current settings store has `vrScale` (default 4). Will add `arMode`, `arModeType`, `arHeight`.
</interfaces>
</context>

<tasks>

<task type="auto">
<name>Task 1: Add AR settings, session init, and camera positioning</name>
<files>src/store.js, src/vr/VRSession.js, src/vr/VRCamera.js, src/renderer.js</files>
<action>
Add AR support across four files:

**1. src/store.js — AR settings**
Add to `defaultSettings` object (after `vrScale: 4` line):
- `arMode: false` — whether to show AR button instead of VR button
- `arModeType: 'roomscale'` — `'roomscale'` (floor) or `'tabletop'` (elevated)
- `arHeight: 0.75` — table height in meters for tabletop mode

These settings persist through localStorage via the existing `dropfall_settings` key.

**2. src/vr/VRSession.js — AR session init**
Add at the top:
```js
import { ARButton } from 'three/addons/webxr/ARButton.js';
```

Add after `initVR` function:
```js
export function initAR(renderer) {
    if (!renderer) {
        throw new Error('[VRSession] initAR requires a valid renderer');
    }

    activeRenderer = renderer;
    activeRenderer.xr.enabled = true;
    activeRenderer.xr.setReferenceSpaceType('local-floor');
    activeRenderer.xr.setFramebufferScaleFactor(1.0);

    // remove existing listeners to avoid duplicates if re-entering
    // (XR event listeners are managed by Three.js ARButton internally,
    //  we keep our own callbacks via sessionstart/sessionend on renderer.xr)

    activeRenderer.xr.addEventListener('sessionstart', () => {
        console.log('[VRSession] AR session started');
        // In AR mode: clear scene background so passthrough shows
        if (activeRenderer.xr.getSession()?.mode === 'immersive-ar') {
            const scene = activeRenderer.domElement?.__threeScene;
            if (scene) scene.background = null;
        }
        if (sessionStartCallback) sessionStartCallback();
    });

    activeRenderer.xr.addEventListener('sessionend', () => {
        console.log('[VRSession] AR session ended');
        if (sessionEndCallback) sessionEndCallback();
    });

    return ARButton.createButton(activeRenderer, {
        requiredFeatures: [],
        optionalFeatures: ['dom-overlay']
    });
}
```

Add helper functions:
```js
export function isInAR() {
    if (!activeRenderer || !activeRenderer.xr) return false;
    const session = activeRenderer.xr.getSession();
    return !!(session && session.mode === 'immersive-ar');
}

export function getXRSessionMode() {
    if (!activeRenderer || !activeRenderer.xr) return null;
    const session = activeRenderer.xr.getSession();
    return session ? session.mode : null;
}
```

**3. src/vr/VRCamera.js — Tabletop height offset**
Add import at top:
```js
import { isInAR } from './VRSession.js';
```

Modify `applyVRScale` function. After setting `currentScale` and before `lastAppliedVRScale = vrScale`, add tabletop height offset:
```js
    // AR tabletop mode: elevate container to configured table height
    if (isInAR()) {
        const { useGameStore } = await import('../store.js');
        const settings = useGameStore.getState().settings || {};
        const arModeType = settings.arModeType || 'roomscale';
        if (arModeType === 'tabletop') {
            const arHeight = Number.isFinite(settings.arHeight) ? settings.arHeight : 0.75;
            vrContainer.position.set(0, arHeight, 0);
        } else {
            vrContainer.position.set(0, 0, 0);
        }
    } else {
        vrContainer.position.set(0, 0, 0);
    }
```

Wait — `applyVRScale` isn't async. The `import()` approach is problematic. Instead, import `useGameStore` at the top of the file (it's already imported at the top of VRCamera.js). Let me check — yes, line 2 already has `import { useGameStore } from '../store.js';`.

So the modification is cleaner. After the scale calculation and before `lastAppliedVRScale = vrScale;`, add:
```js
    // AR tabletop mode: elevate container to configured table height
    if (isInAR()) {
        const settings = useGameStore.getState().settings || {};
        const arModeType = settings.arModeType || 'roomscale';
        const arHeight = Number.isFinite(settings.arHeight) ? settings.arHeight : 0.75;
        vrContainer.position.set(0, arModeType === 'tabletop' ? arHeight : 0, 0);
    } else {
        vrContainer.position.set(0, 0, 0);
    }
```

Also update `updateVRCameraRig` function to call `applyVRScale()` (which already happens on line 94 — good, it's already there).

**4. src/renderer.js — Transparent background for AR**
In `initRenderer` function, add `alpha: true` to the WebGLRenderer constructor options (around line 31):
```js
renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    alpha: true  // Required for AR passthrough — background transparency
});
```

This is safe in non-AR mode because the scene background (set by Arena theme) and CSS background color (`#050510`) will still render fully opaque.
</action>
<verify>
<automated>grep -n "arMode\|arModeType\|arHeight\|initAR\|isInAR\|getXRSessionMode\|alpha.*true" src/store.js src/vr/VRSession.js src/vr/VRCamera.js src/renderer.js</automated>
</verify>
<done>
- Store has arMode, arModeType, arHeight defaults
- VRSession exports initAR, isInAR, getXRSessionMode
- VRCamera applies tabletop height offset when in AR tabletop mode
- Renderer has alpha:true for AR passthrough transparency
</done>
</task>

<task type="auto">
<name>Task 2: Wire AR into main.js init and HTML</name>
<files>src/main.js, index.html</files>
<action>
Wire the AR module into the game and add AR UI controls:

**1. Set scene.background for AR on session start (if not handled by ARButton)**
The ARButton from Three.js sets `scene.background = null` automatically when entering AR,
but we need to restore it when exiting AR.

In main.js `init()`, modify the `onVRSessionEnd` callback to restore the scene background:
```js
onVRSessionEnd(() => {
    reparentToScene(scene);
    // Restore scene background when leaving XR (AR sets it to null)
    // Arena.ts handles setting scene background based on theme
});
```

The scene background restoration is handled by the Arena entity during `resetEntities()` 
or `returnToMenu()`, so we don't need explicit restoration here.

**2. Create AR button alongside VR button in init()**
In `init()` function (around line 2209-2210), add AR button creation:

```js
// VR button
const vrButton = initVR(renderer);
document.body.appendChild(vrButton);

// AR button (hidden by default, shown when AR mode selected)
const arButton = initAR(renderer);
arButton.id = 'ARButton';
document.body.appendChild(arButton);

// Show/hide XR buttons based on store setting
const updateXRButtons = () => {
    const settings = useGameStore.getState().settings;
    const showAR = settings.arMode === true;
    vrButton.style.display = showAR ? 'none' : '';
    arButton.style.display = showAR ? '' : 'none';
};
updateXRButtons();

// Subscribe to XR mode changes
useGameStore.subscribe((state, prevState) => {
    if (state.settings?.arMode !== prevState.settings?.arMode) {
        updateXRButtons();
    }
    if (state.settings?.arHeight !== prevState.settings?.arHeight ||
        state.settings?.arModeType !== prevState.settings?.arModeType) {
        // Re-apply camera positioning when AR settings change
        applyVRScale();
    }
});
```

**3. Add AR settings controls to the settings panel HTML**
The settings "Gameplay" pane already has a `vr-scale` slider. Add AR controls right after it.

In `index.html`, after the `vr-scale` setting item (around line 300-303 in the gameplay pane), add AR controls:

```html
<div class="setting-item" style="grid-column: 1 / -1; border-top: 1px solid rgba(0,255,255,0.3); padding-top: 0.75rem; margin-top: 0.5rem;">
  <label style="font-size: 0.95rem; color: #ff00ff; text-shadow: 0 0 5px #ff00ff;">AR MODE</label>
</div>
<div class="setting-item">
  <label for="ar-mode">Enable AR</label>
  <select id="ar-mode" style="background: #000; color: #0ff; border: 1px solid #0ff; padding: 4px 8px; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem;">
    <option value="false">Off (VR)</option>
    <option value="true">On (AR)</option>
  </select>
</div>
<div class="setting-item">
  <label for="ar-mode-type">AR Mode</label>
  <select id="ar-mode-type" style="background: #000; color: #0ff; border: 1px solid #0ff; padding: 4px 8px; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem;">
    <option value="roomscale">Roomscale (Floor)</option>
    <option value="tabletop">Tabletop (Elevated)</option>
  </select>
</div>
<div class="setting-item">
  <label for="ar-height">Table Height (m)</label>
  <input type="range" id="ar-height" min="0.3" max="1.5" step="0.05" value="0.75">
  <span id="ar-height-val">0.75</span>
</div>
```

Add AR controls mapping to the settings handler in `main.js` `setupButtonHandlers()`:

```js
// AR mode controls
document.getElementById('ar-mode')?.addEventListener('change', (e) => {
    useGameStore.getState().updateSetting('arMode', e.target.value === 'true');
});
document.getElementById('ar-mode-type')?.addEventListener('change', (e) => {
    useGameStore.getState().updateSetting('arModeType', e.target.value);
});
document.getElementById('ar-height')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('ar-height-val').textContent = val.toFixed(2);
    useGameStore.getState().updateSetting('arHeight', val);
});
```

**4. Add CSS for AR button in index.html**
Extend the existing `#VRButton` CSS rule to also cover ARButton:

In `index.html` `<style>` block (around line 14-21), add `#ARButton` alongside `#VRButton`:
```css
#VRButton, #ARButton {
    position: fixed !important;
    bottom: 80px !important;  /* Staggered above VR button */
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 9999 !important;
}
#VRButton {
    bottom: 20px !important;
}
#ARButton {
    bottom: 80px !important;
}
```

**5. Sync AR controls with store value on startup**
In `setupButtonHandlers()` or at the end of `setupButtonHandlers()`, add:
```js
// Sync AR controls with stored values
const syncARSettings = () => {
    const settings = useGameStore.getState().settings;
    const arModeEl = document.getElementById('ar-mode');
    const arModeTypeEl = document.getElementById('ar-mode-type');
    const arHeightEl = document.getElementById('ar-height');
    const arHeightVal = document.getElementById('ar-height-val');
    
    if (arModeEl) arModeEl.value = settings.arMode ? 'true' : 'false';
    if (arModeTypeEl) arModeTypeEl.value = settings.arModeType || 'roomscale';
    if (arHeightEl) arHeightEl.value = settings.arHeight ?? 0.75;
    if (arHeightVal) arHeightVal.textContent = (settings.arHeight ?? 0.75).toFixed(2);
};
syncARSettings();
```

**6. Also add AR mode to `settingsMap`** in setupButtonHandlers (the object that maps HTML IDs to store keys), so AR settings also get reset properly.
</action>
<verify>
<automated>grep -n "initAR\|arMode\|ARButton\|ar-mode\|ar-mode-type\|ar-height" src/main.js index.html</automated>
</verify>
<done>
- AR button created alongside VR button, visibility toggled by `arMode` setting
- AR mode, AR type (roomscale/tabletop), and table height controls in settings
- CSS styles both VR and AR buttons
- AR controls synced with store on startup
- Store subscription handles AR setting changes
</done>
</task>

</tasks>

<verification>

### Post-implementation verification checklist:

1. **Build check**: `npm run build` — no errors
2. **Setting sync**: Open settings panel → Gameplay pane → AR Mode toggle, AR Mode dropdown, Table Height slider all appear and sync with store
3. **Button visibility**: Toggle AR Mode in settings → VR/AR button switches appropriately
4. **Roomscale AR**: With AR Mode=On and AR Mode=Roomscale, click "Enter AR" → passthrough visible behind arena, arena on floor
5. **Tabletop AR**: With AR Mode=On and AR Mode=Tabletop, click "Enter AR" → arena elevated to configured table height
6. **Height adjustment**: Adjust Table Height slider while in AR → arena repositions
7. **Controller input**: Through-XR controller input works identically in AR as in VR
8. **Non-XR unaffected**: Desktop/non-XR mode renders the same as before (fully opaque background)

<automated>MISSING — requires headset to test; check `npm run build` passes for code integrity</automated>
</verification>

<success_criteria>
- npm run build succeeds (no syntax/import errors)
- AR button appears when AR Mode is enabled in settings
- AR session starts with passthrough background
- Roomscale places arena on floor, tabletop elevates it to configured height
- All controller input and game logic works identically to VR mode
- Desktop/non-AR gameplay is visually unchanged (opaque background)
</success_criteria>

<output>
After completion, create `.planning/quick/260526-tmm-add-ar-mode-to-dropfall-vr-headset-rooms/260526-tmm-SUMMARY.md`
</output>
