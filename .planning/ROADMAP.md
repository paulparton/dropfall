---
milestone: v2.3
created: 2026-04-28
---

# Dropfall v2.3 Roadmap: First-Class Mobile Support

## Overview

This roadmap delivers first-class mobile support for Dropfall while preserving the existing desktop experience unchanged. The 5-phase structure progresses from responsive foundation → touch controls → UI polish → performance → game mode integration.

**Total Phases:** 5
**Granularity:** Standard
**Coverage:** 29/29 v2.3 requirements mapped

## Phases

- [ ] **Phase 1: Responsive Layout Foundation** - Responsive layout system with desktop unchanged, mobile optimized
- [ ] **Phase 2: Touch Controls Implementation** - Virtual joystick and touch-drag controls for ball movement
- [ ] **Phase 3: Mobile UI Polish** - Touch-friendly UI elements, HUD repositioning, mobile layouts
- [ ] **Phase 4: Performance Optimization** - Mobile GPU optimizations, battery-friendly rendering
- [ ] **Phase 5: Gesture Handling & Game Modes** - Gesture support, classic and race modes fully playable on mobile

## Phase Details

### Phase 1: Responsive Layout Foundation
**Goal**: Responsive layout system that adapts to screen size while keeping desktop layout unchanged
**Depends on**: Nothing (first phase)
**Requirements**: RL-01, RL-02, RL-03, RL-04, RL-05, RL-06
**Success Criteria** (what must be TRUE):
  1. Desktop layout (≥1024px) renders identically to pre-v2.3 state with no visual changes
  2. Mobile layout (<768px) activates automatically with optimized arrangement for small screens
  3. Tablet layout (768px-1023px) provides usable experience via scaled desktop or hybrid approach
  4. iOS devices with notch/home indicator display game content without obstruction in safe areas
  5. Rotating device between portrait and landscape updates layout appropriately without breaking the game
**Plans**: TBD

### Phase 2: Touch Controls Implementation
**Goal**: Touch screen controls that allow full gameplay via virtual joystick or touch-drag
**Depends on**: Phase 1 (responsive layout must exist before adding touch controls)
**Requirements**: TC-01, TC-02, TC-03, TC-04, TC-05, TC-06
**Success Criteria** (what must be TRUE):
  1. Player can control ball movement on touch screens using virtual joystick with <16ms latency
  2. Player can alternatively use touch-drag (drag finger anywhere to move ball) with same responsiveness
  3. All menus and UI interactions (start game, pause, settings) fully navigable via touch taps and scrolls
  4. Desktop users see no touch controls (mouse/keyboard input unchanged and touch UI hidden)
  5. Touch interactions provide immediate visual feedback (joystick moves, buttons show pressed state)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Mobile UI Polish
**Goal**: Mobile-optimized UI with touch-friendly targets and thumb-friendly layout
**Depends on**: Phase 2 (touch controls need UI elements to interact with)
**Requirements**: MUI-01, MUI-02, MUI-03, MUI-04, MUI-05
**Success Criteria** (what must be TRUE):
  1. All interactive elements (buttons, menu items, HUD controls) meet minimum 44px touch target size
  2. HUD elements (score, timer, pause button) repositioned to thumb-friendly zones at screen bottom
  3. Text remains readable on mobile screens with minimum 16px font size for all body text
  4. Buttons and interactive elements spaced with minimum 8px gap to prevent accidental taps
  5. Mobile menus and overlays (settings, pause, game over) use full-screen modal layout optimized for touch
**Plans**: TBD
**UI hint**: yes

### Phase 4: Performance Optimization
**Goal**: Smooth performance on mobile devices with battery-friendly rendering
**Depends on**: Phase 2 (optimize after core mobile functionality exists)
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. Game maintains minimum 30fps on mid-range mobile devices during active gameplay
  2. Particle effects (confetti, tile destruction, boost trails) reduced or disabled on mobile GPUs
  3. Rendering loop avoids unnecessary redraws when game state hasn't changed (battery savings)
  4. Texture assets optimized for mobile memory constraints (compressed formats, appropriate sizes)
  5. Desktop performance maintained at 60fps with no regression from mobile optimizations
**Plans**: TBD

### Phase 5: Gesture Handling & Game Modes
**Goal**: Gesture support and full mobile playability for both Classic and Race modes
**Depends on**: Phase 3, Phase 4 (UI polish and performance needed before final integration)
**Requirements**: GEST-01, GEST-02, GEST-03, GM-01, GM-02, GM-03, GM-04
**Success Criteria** (what must be TRUE):
  1. Swipe gestures navigate menus (swipe left/right to switch settings tabs, dismiss modals)
  2. Pinch-to-zoom and double-tap zoom disabled so game viewport remains fixed during play
  3. Classic mode fully playable end-to-end on mobile using touch controls with no missing functionality
  4. Race mode fully playable end-to-end on mobile with touch controls and proper timer/checkpoint display
  5. Mode selection screen touch-optimized with large targets and mobile-appropriate layout
  6. Game pause/resume works correctly on mobile with no focus loss issues when switching apps or locking screen
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Responsive Layout Foundation | 0/3 | Not started | - |
| 2. Touch Controls Implementation | 0/3 | Not started | - |
| 3. Mobile UI Polish | 0/2 | Not started | - |
| 4. Performance Optimization | 0/2 | Not started | - |
| 5. Gesture Handling & Game Modes | 0/3 | Not started | - |

---
*Roadmap created: 2026-04-28 for v2.3 Mobile Support milestone*
