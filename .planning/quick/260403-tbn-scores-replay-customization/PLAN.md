---
phase: quick-task-260403-tbn
quick_id: 260403-tbn
description: Implement player scores tracking, replay system, and character customization
date_created: 2026-04-03
must_haves:
  truths:
    - Store already has p1Score, p2Score, p1Hat, p2Hat fields
    - Ball rendering uses canvas texture with Three.js sphere mesh
    - Game loop runs at 60fps and has access to entity state each frame
    - HTML overlay can be rendered on top of Three.js canvas
    - Customization must occur in CUSTOMIZATION game state before COUNTDOWN
  artifacts:
    - src/components/ScoresOverlay.ts (HTML overlay showing scores)
    - src/systems/ReplayRecorder.ts (frame buffer recording system)
    - src/systems/ReplayPlayer.ts (frame playback system)
    - src/components/CustomizationModal.ts (color/hat selection UI)
  key_links:
    - src/store.ts (state management source of truth)
    - src/main.js (game loop and state machine)
    - src/renderer.js (Three.js scene and rendering)
    - src/entities/Player.js (ball mesh creation)
---

# Quick Task 260403-tbn: Detailed Implementation Plan

**Task:** Implement player scores tracking, replay system, and character customization  
**Status:** Ready for execution  
**Estimated Effort:** 8-11 hours (chunked into 3 feature tracks)

---

## FEATURE TRACK 1: SCORES DISPLAY (Priority: 1st)

### Goal
Display player win scores prominently during gameplay and round state, updating in real-time from store.

### Tasks

#### T1.1: Create ScoresOverlay Component
**Files:** Create `src/components/ScoresOverlay.ts`

**Action:**
```typescript
// ScoresOverlay.ts
import { useGameStore } from '../store.js';

export function createScoresOverlay() {
  const container = document.createElement('div');
  container.id = 'scores-overlay';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    font-size: 24px;
  `;
  document.body.appendChild(container);

  // Subscribe to store updates
  useGameStore.subscribe(
    (state) => {
      const { p1Name, p2Name, p1Score, p2Score } = state;
      container.innerHTML = `
        <div style="text-align: right;">
          <div style="font-size: 18px; margin-bottom: 8px;">Match Score</div>
          <div style="font-size: 28px;">${p1Name}: ${p1Score}</div>
          <div style="font-size: 28px;">${p2Name}: ${p2Score}</div>
        </div>
      `;
    }
  );

  return container;
}
```

**Verify:**
- [ ] Overlay renders at top-right corner
- [ ] Updates when p1Score or p2Score changes in store
- [ ] Visible over Three.js canvas (z-index: 100)
- [ ] Responsive positioning at different resolutions

**Done:** Overlay component created and tested

---

#### T1.2: Integrate ScoresOverlay into Game Loop
**Files:** Modify `src/main.js`

**Action:**
- Import ScoresOverlay at top:
  ```javascript
  import { createScoresOverlay } from './components/ScoresOverlay.js';
  ```
- After initRenderer() inside main init block, add:
  ```javascript
  let scoresOverlay;
  // Call once after renderer is ready
  scoresOverlay = createScoresOverlay();
  ```

**Verify:**
- [ ] Scores overlay displays immediately when game starts
- [ ] No console errors on import
- [ ] Overlay visible during both single-player and online modes

**Done:** Overlay integrated into main game loop

---

#### T1.3: Add Color Fields to Store (if missing)
**Files:** Modify `src/store.ts`

**Action:**
- Check if `p1Color` and `p2Color` exist in GameSettings interface
- If missing, add:
  ```typescript
  p1Color: number; // hex color code
  p2Color: number; // hex color code
  ```
- Initialize defaults in store creation:
  ```typescript
  p1Color: 0xff0000, // red
  p2Color: 0x0000ff, // blue
  ```

**Verify:**
- [ ] Store compiles without TypeScript errors
- [ ] p1Color and p2Color are accessible via useGameStore.getState()

**Done:** Color fields added to store

---

### Subtask Dependencies
- T1.1 → T1.2 (ScoresOverlay must exist before integrating)
- T1.3 → (independent; can run in parallel)

### Testing Checklist
- [ ] Start game → Scores show "Player 1: 0, Player 2: 0"
- [ ] Win a round → p1Score increments, overlay updates immediately
- [ ] Win another round → p2Score increments, overlay updates immediately
- [ ] Overlay stays visible during pause/round end screens

---

## FEATURE TRACK 2: REPLAY SYSTEM (Priority: 2nd)

### Goal
Record complete frame history during gameplay, enable playback of falling clip at round end, and provide manual replay viewer.

### Tasks

#### T2.1: Create ReplayRecorder System
**Files:** Create `src/systems/ReplayRecorder.ts`

**Action:**
- Implement circular buffer:
  ```typescript
  interface FrameState {
    timestamp: number;
    player1: { position: [x, y, z]; velocity: [vx, vy, vz]; rotation: [qx, qy, qz, qw]; boost: number };
    player2: { position: [x, y, z]; velocity: [vx, vy, vz]; rotation: [qx, qy, qz, qw]; boost: number };
    winner?: string | null;
  }

  export class ReplayRecorder {
    private buffer: FrameState[] = [];
    private maxFrames = 1000;
    private isRecording = false;

    startRecording() { this.isRecording = true; }
    stopRecording() { this.isRecording = false; }
    
    recordFrame(frameState: FrameState) {
      if (!this.isRecording) return;
      if (this.buffer.length >= this.maxFrames) {
        this.buffer.shift(); // Remove oldest frame
      }
      this.buffer.push(frameState);
    }

    getBuffer() { return [...this.buffer]; }
    clear() { this.buffer = []; }
  }
  ```

**Verify:**
- [ ] ReplayRecorder compiles
- [ ] recordFrame() adds frames to buffer
- [ ] Buffer auto-trims when exceeding maxFrames
- [ ] getBuffer() returns copy of recorded frames

**Done:** ReplayRecorder class created and unit tested

---

#### T2.2: Create ReplayPlayer System
**Files:** Create `src/systems/ReplayPlayer.ts`

**Action:**
- Implement playback controller:
  ```typescript
  export class ReplayPlayer {
    private buffer: FrameState[] = [];
    private currentIndex = 0;
    private playbackSpeed = 1.0;
    private isPaused = false;

    loadBuffer(buffer: FrameState[]) { this.buffer = [...buffer]; }
    
    play() { this.isPaused = false; }
    pause() { this.isPaused = true; }
    setSpeed(speed: number) { this.playbackSpeed = Math.max(0.1, speed); }
    
    getCurrentFrame(): FrameState | null {
      return this.buffer[this.currentIndex] || null;
    }

    update(deltaTime: number) {
      if (this.isPaused || this.buffer.length === 0) return;
      this.currentIndex += this.playbackSpeed * deltaTime * 60; // 60fps baseline
      if (this.currentIndex >= this.buffer.length) {
        this.currentIndex = this.buffer.length - 1;
        this.isPaused = true; // Auto-stop at end
      }
    }

    reset() { this.currentIndex = 0; }
  }
  ```

**Verify:**
- [ ] ReplayPlayer compiles
- [ ] play/pause/setSpeed work correctly
- [ ] getCurrentFrame() returns correct frame at current index
- [ ] Playback stops at end of buffer

**Done:** ReplayPlayer class created and unit tested

---

#### T2.3: Integrate Recording into Game Loop
**Files:** Modify `src/main.js`

**Action:**
- Import ReplayRecorder:
  ```javascript
  import { ReplayRecorder } from './systems/ReplayRecorder.js';
  ```
- Create global instance:
  ```javascript
  const replayRecorder = new ReplayRecorder();
  ```
- In game loop (inside main animate function), before rendering:
  ```javascript
  // When game state is PLAYING
  if (store.gameState === 'PLAYING') {
    if (!recordingStarted) {
      replayRecorder.startRecording();
      recordingStarted = true;
    }
    // Record current frame state
    replayRecorder.recordFrame({
      timestamp: Date.now(),
      player1: { /* extract from physics bodies */ },
      player2: { /* extract from physics bodies */ },
    });
  } else if (store.gameState !== 'PLAYING' && recordingStarted) {
    replayRecorder.stopRecording();
    recordingStarted = false;
  }
  ```

**Verify:**
- [ ] No console errors on startup
- [ ] Recording starts when game enters PLAYING state
- [ ] Recording stops when game transitions out of PLAYING
- [ ] Frame data captured each frame

**Done:** Recording integrated into game loop

---

#### T2.4: Create Replay UI Modal
**Files:** Create `src/components/ReplayModal.ts`

**Action:**
- Build modal component for replay viewer:
  ```typescript
  export function createReplayModal(buffer: FrameState[]) {
    const modal = document.createElement('div');
    modal.id = 'replay-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      background: rgba(0, 0, 0, 0.9);
      padding: 20px;
      border-radius: 10px;
      color: white;
      min-width: 400px;
      text-align: center;
    `;
    
    modal.innerHTML = `
      <h2>Replay</h2>
      <div id="replay-player" style="width: 100%; height: 300px; background: #111; margin: 20px 0;"></div>
      <div>
        <button id="play-btn">Play</button>
        <button id="pause-btn">Pause</button>
        <button id="close-btn">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
  }
  ```

**Verify:**
- [ ] Modal appears on screen with correct styling
- [ ] Buttons are clickable and functional
- [ ] Modal closes without errors

**Done:** Replay UI modal created

---

#### T2.5: Trigger Replay Display after Round Over
**Files:** Modify `src/main.js`

**Action:**
- Before transitioning from ROUND_OVER to next state, check if replay should display
- Automatically show 3-second falling clip replay
- Offset: 3 seconds before round end
  ```javascript
  if (store.gameState === 'ROUND_OVER') {
    // Extract falling period from buffer
    const fallingStartIndex = replayRecorder.getBuffer().length - 180; // ~3 sec at 60fps
    const fallingBuffer = replayRecorder.getBuffer().slice(fallingStartIndex);
    // Show replay modal
    showReplayModal(fallingBuffer);
  }
  ```

**Verify:**
- [ ] Replay modal appears automatically after round ends
- [ ] Shows correct frame range (falling sequence)
- [ ] Closes after playback completes or on user action

**Done:** Replay triggered and displayed

---

### Subtask Dependencies
- T2.1 → T2.2 (ReplayRecorder interface used by ReplayPlayer)
- T2.2 → T2.4 (ReplayPlayer needed by modal)
- T2.1 → T2.3 (ReplayRecorder instance needed in game loop)
- T2.3, T2.4 → T2.5 (Both components needed for final integration)

### Testing Checklist
- [ ] Start game → Recording begins
- [ ] Play 1 round → Buffer contains ~360-480 frames (6-8 seconds)
- [ ] Round ends → Replay modal appears showing falling sequence
- [ ] Replay plays at normal speed
- [ ] Manual replay pause/play buttons work
- [ ] Modal closes cleanly

---

## FEATURE TRACK 3: CHARACTER CUSTOMIZATION (Priority: 3rd)

### Goal
Enable players to select ball colors and hat styles before match start with live 3D preview.

### Tasks

#### T3.1: Create Color Palette Definition
**Files:** Create `src/components/ColorPalette.ts`

**Action:**
- Define color system:
  ```typescript
  export const COLOR_PALETTE = {
    neon: [
      { name: 'Cyan', hex: 0x00ffff },
      { name: 'Lime', hex: 0x00ff00 },
      { name: 'Magenta', hex: 0xff00ff },
    ],
    dark: [
      { name: 'Navy', hex: 0x000080 },
      { name: 'Charcoal', hex: 0x333333 },
      { name: 'Burgundy', hex: 0x800020 },
    ],
    metallic: [
      { name: 'Gold', hex: 0xffd700 },
      { name: 'Silver', hex: 0xc0c0c0 },
      { name: 'Copper', hex: 0xb87333 },
    ],
    jewel: [
      { name: 'Ruby', hex: 0xe0115f },
      { name: 'Emerald', hex: 0x50c878 },
      { name: 'Sapphire', hex: 0x0f52ba },
    ],
  };

  export function getAllColors() {
    return Object.values(COLOR_PALETTE).flat();
  }
  ```

**Verify:**
- [ ] Color palette compiles
- [ ] getAllColors() returns 12 color objects
- [ ] Each color has name and hex value

**Done:** Color palette defined

---

#### T3.2: Create CustomizationModal Component
**Files:** Create `src/components/CustomizationModal.ts`

**Action:**
- Build modal with color/hat selection:
  ```typescript
  export function createCustomizationModal(playerName: string, onConfirm: (color: number, hat: string) => void) {
    const modal = document.createElement('div');
    modal.id = 'customization-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      background: rgba(20, 20, 40, 0.95);
      padding: 30px;
      border-radius: 15px;
      color: white;
      border: 2px solid #00ffff;
      text-align: center;
      font-family: Arial, sans-serif;
    `;
    
    const colors = getAllColors();
    const hats = ['none', 'santa', 'cowboy', 'crown', 'wizard'];
    
    // Build color swatches
    let colorSwatchesHTML = '<div class="color-swatches" style="display: grid; grid-template-columns: repeat(4, 60px); gap: 10px; margin: 20px auto; justify-content: center;">';
    colors.forEach(color => {
      colorSwatchesHTML += `
        <div class="color-swatch" data-color="${color.hex}" 
          style="width: 60px; height: 60px; background: #${color.hex.toString(16).padStart(6, '0')}; 
          border: 2px solid transparent; border-radius: 50%; cursor: pointer; transition: all 0.2s;">
          ${color.name}
        </div>
      `;
    });
    colorSwatchesHTML += '</div>';
    
    // Build hat options
    let hatHTML = '<div class="hat-options" style="display: flex; gap: 20px; margin: 20px auto; justify-content: center;">';
    hats.forEach(hat => {
      hatHTML += `
        <button class="hat-option" data-hat="${hat}" 
          style="padding: 10px 20px; background: ${hat === 'none' ? '#666' : '#00ffff'}; 
          color: black; border: none; border-radius: 5px; cursor: pointer;">
          ${hat}
        </button>
      `;
    });
    hatHTML += '</div>';
    
    modal.innerHTML = `
      <h2>Customize ${playerName}</h2>
      <div>
        <h3>Select Color</h3>
        ${colorSwatchesHTML}
        <h3>Select Hat</h3>
        ${hatHTML}
        <button id="confirm-btn" style="margin-top: 20px; padding: 12px 30px; background: #00ff00; color: black; 
          border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold;">
          Confirm
        </button>
      </div>
    `;
    
    let selectedColor = 0xff0000;
    let selectedHat = 'none';
    
    // Event listeners...
    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('color-swatch')) {
        selectedColor = parseInt(target.dataset.color || '0xff0000', 16);
        // Update preview...
      }
      if (target.classList.contains('hat-option')) {
        selectedHat = target.dataset.hat || 'none';
        // Update preview...
      }
      if (target.id === 'confirm-btn') {
        onConfirm(selectedColor, selectedHat);
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
    return modal;
  }
  ```

**Verify:**
- [ ] Modal displays with color swatches
- [ ] Hat options display and are clickable
- [ ] Color selection updates selectedColor variable
- [ ] Hat selection updates selectedHat variable
- [ ] Confirm button closes modal and calls callback

**Done:** Customization modal created

---

#### T3.3: Add Live 3D Preview to Customization Modal
**Files:** Modify `src/components/CustomizationModal.ts`

**Action:**
- Extend customization modal with Three.js preview:
  ```typescript
  // Inside createCustomizationModal, create a preview scene
  const previewContainer = document.createElement('div');
  previewContainer.style.cssText = `
    width: 200px;
    height: 200px;
    margin: 0 auto 20px;
    background: #1a1a2e;
    border-radius: 10px;
  `;
  
  // Inject Three.js scene with ball preview
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  
  renderer.setSize(200, 200);
  previewContainer.appendChild(renderer.domElement);
  
  // Create preview ball using existing createBallWithHatCanvas function
  // Update when color/hat selection changes
  ```

**Verify:**
- [ ] Preview renders in modal
- [ ] Preview updates when color selection changes
- [ ] Preview updates when hat selection changes
- [ ] No WebGL errors in console

**Done:** 3D preview integrated

---

#### T3.4: Add CUSTOMIZATION State to Game State Machine
**Files:** Modify `src/main.js` and `src/store.ts`

**Action:**
- Update GameState type in store to include CUSTOMIZATION:
  ```typescript
  // In store.ts type definition
  type GameState = '...' | 'CUSTOMIZATION' | '...';
  ```
- Update game state machine in main.js:
  ```javascript
  // In state transition logic
  case 'NAME_ENTRY':
    if (/* name entry complete */) {
      store.setState({ gameState: 'CUSTOMIZATION' });
    }
    break;
  case 'CUSTOMIZATION':
    // Show customization modal
    // On confirm, update p1Color/p1Hat or p2Color/p2Hat
    // Then transition to COUNTDOWN
    if (/* customization complete */) {
      store.setState({ gameState: 'COUNTDOWN' });
    }
    break;
  case 'COUNTDOWN':
    // Existing countdown logic...
    break;
  ```

**Verify:**
- [ ] TypeScript compiles without errors
- [ ] Game transitions to CUSTOMIZATION state after name entry
- [ ] Game transitions to COUNTDOWN state after customization
- [ ] No state machine loops or hangs

**Done:** State machine updated

---

#### T3.5: Integrate Customization Display into UI
**Files:** Modify `src/main.js`

**Action:**
- In game loop, when gameState === 'CUSTOMIZATION':
  ```javascript
  if (store.gameState === 'CUSTOMIZATION' && !customizationModalShown) {
    const onConfirm = (color, hat) => {
      if (currentPlayer === 1) {
        store.setState({ p1Color: color, p1Hat: hat });
      } else {
        store.setState({ p2Color: color, p2Hat: hat });
      }
      // Move to next player or countdown
    };
    createCustomizationModal(store.p1Name, onConfirm);
    customizationModalShown = true;
  }
  ```

**Verify:**
- [ ] Customization modal appears when game enters CUSTOMIZATION state
- [ ] Modal closes and transitions to next state on confirm
- [ ] Selected colors/hats stored in store

**Done:** Customization integrated into game loop

---

#### T3.6: Update Ball Rendering to Use Selected Colors
**Files:** Modify `src/entities/Player.js`

**Action:**
- Update ball creation to pull color from store instead of generating random:
  ```javascript
  // In Player.js constructor or factory function
  const color = store.p1Color || 0xff0000; // Use store color, fallback to red
  const hat = store.p1Hat || 'none';
  this.setupBall(color, hat);
  ```

**Verify:**
- [ ] Ball renders with selected color
- [ ] Ball renders with selected hat
- [ ] Color persists throughout match

**Done:** Ball rendering uses customization

---

#### T3.7: Apply Customization to AI in Single-Player
**Files:** Modify `src/ai/AIController.js` and game start logic

**Action:**
- In single-player mode, apply customization to AI opponent:
  ```javascript
  if (gameMode === '1P') {
    // Show customization for player 1
    // Show customization for AI player (with different modal)
    // Store AI choices in p2Color, p2Hat
  }
  ```

**Verify:**
- [ ] AI opponent shows customization screen in single-player
- [ ] AI color/hat customizable independently
- [ ] AI ball renders with selected customization

**Done:** AI customization implemented

---

### Subtask Dependencies
- T3.1 (independent, can start first)
- T3.2 → T3.3 (Preview added to modal)
- T3.1, T3.2 → remaining (Color palette and modal needed by all)
- T3.4 → T3.5 (State machine needed before integration)
- T3.5 → T3.6 (Ball needs store integration after modal confirms)
- T3.6 → T3.7 (Ball rendering working before applying to AI)

### Testing Checklist
- [ ] Game transitions to CUSTOMIZATION state after name entry
- [ ] Customization modal displays with color swatches and hat options
- [ ] 3D preview updates in real-time when selections change
- [ ] Confirm button saves to store and transitions to COUNTDOWN
- [ ] Player 1 ball renders with selected color/hat
- [ ] In single-player, both player and AI have customization
- [ ] In multiplayer, both players see separate customization screens
- [ ] Color/hat persists throughout full match

---

## CROSS-FEATURE INTEGRATION

### Store Schema Updates
Verify store contains all required fields:
- [ ] `p1Score`, `p2Score` (existing, used by ScoresOverlay)
- [ ] `p1Color`, `p2Color` (added in T1.3)
- [ ] `p1Hat`, `p2Hat` (existing, used by customization)
- [ ] `gameState` includes 'CUSTOMIZATION' (updated in T3.4)

### Game Loop Hooks
Required insertions in `src/main.js` animate function:
- [ ] Frame recording (T2.3)
- [ ] Scores overlay rendering (T1.2)
- [ ] Customization state handling (T3.5)

### New Files Created
- `src/components/ScoresOverlay.ts` (T1.1)
- `src/systems/ReplayRecorder.ts` (T2.1)
- `src/systems/ReplayPlayer.ts` (T2.2)
- `src/components/ReplayModal.ts` (T2.4)
- `src/components/ColorPalette.ts` (T3.1)
- `src/components/CustomizationModal.ts` (T3.2)

### Files Modified
- `src/main.js` (T1.2, T2.3, T3.5)
- `src/store.ts` (T1.3, T3.4)
- `src/entities/Player.js` (T3.6)
- `src/ai/AIController.js` (T3.7)

---

## VERIFICATION GATES

### Before Commit
- [ ] All TypeScript compiles without errors
- [ ] No console warnings on game start
- [ ] Game loop runs at 60fps during all states
- [ ] No memory leaks (replay buffer trimmed properly)
- [ ] HTML overlays render above canvas

### Functional Verification
- [ ] Scores display and update correctly
- [ ] Replay records and plays back without glitches
- [ ] Customization modal appears and closes smoothly
- [ ] Selected colors/hats apply to balls
- [ ] Game state transitions work correctly

### Cross-Platform Verification
- [ ] Desktop: All features work at 1920x1080
- [ ] Mobile: Features work at 768x1024 (responsive)
- [ ] Mobile: Low-poly preview (no full 3D if performance issues)

---

## ROLLBACK STRATEGY

If a feature becomes problematic during execution:

| Feature | Rollback Task |
|---------|---|
| Scores Display | Remove ScoresOverlay import from main.js; scores remain in store |
| Replay System | Remove ReplayRecorder/Player from game loop; remove ReplayModal |
| Customization | Revert game state to skip CUSTOMIZATION, go direct NAME_ENTRY → COUNTDOWN |

All rollbacks preserve core game loop integrity.

---

## Success Criteria (Final)

✅ **Scores:** Displayed during gameplay, increment on round win, persist per session  
✅ **Replay:** Recorded automatically, plays 3-sec falling clip post-round, manual replay viewer works  
✅ **Customization:** Color/hat selectable, live preview, applied to ball, works in single/multi player  
✅ **Performance:** Game loop 60fps uninterrupted  
✅ **Integration:** All three features coexist without conflicts  
✅ **Quality:** No console errors, responsive UI, smooth animations
