---
milestone: v2.3
created: 2026-04-28
---

# Dropfall v2.3 Requirements: First-Class Mobile Support

## Milestone v2.3 Requirements

### Responsive Layout (RL)
- [ ] **RL-01**: Desktop layout unchanged on screens ≥1024px (existing layout preserved)
- [ ] **RL-02**: Mobile layout activates on screens <768px width
- [ ] **RL-03**: Tablet layout (768px-1023px) uses scaled desktop layout or hybrid approach
- [ ] **RL-04**: Viewport meta tag configured for mobile (initial-scale=1, width=device-width)
- [ ] **RL-05**: Safe area insets handled (notch, home indicator on iOS)
- [ ] **RL-06**: Orientation support — portrait primary for mobile, landscape supported

### Touch Controls (TC)
- [ ] **TC-01**: Virtual joystick for ball movement on touch screens
- [ ] **TC-02**: Touch-drag alternative control scheme (drag finger to move ball)
- [ ] **TC-03**: Touch latency <16ms (feels instant, native-like)
- [ ] **TC-04**: Menu navigation fully usable via touch (tap, scroll)
- [ ] **TC-05**: Touch controls hidden on desktop (mouse/keyboard unchanged)
- [ ] **TC-06**: Visual feedback for touch interactions (pressed states, joystick movement)

### Mobile UI (MUI)
- [ ] **MUI-01**: All interactive elements meet 44px minimum touch target size
- [ ] **MUI-02**: HUD elements repositioned for mobile (thumb-friendly zones)
- [ ] **MUI-03**: Font sizes readable on mobile (minimum 16px for body text)
- [ ] **MUI-04**: Button spacing prevents accidental taps (minimum 8px gap)
- [ ] **MUI-05**: Mobile-specific menu/overlay layouts (full-screen modals on mobile)

### Performance (PERF)
- [ ] **PERF-01**: 30fps minimum maintained on mid-range mobile devices
- [ ] **PERF-02**: Particle effects reduced/disabled on mobile GPUs
- [ ] **PERF-03**: Battery-friendly rendering (limit unnecessary redraws)
- [ ] **PERF-04**: Texture/asset optimization for mobile memory constraints
- [ ] **PERF-05**: 60fps maintained on desktop (no regression)

### Gestures (GEST)
- [ ] **GEST-01**: Swipe gestures for menu navigation (optional enhancement)
- [ ] **GEST-02**: Pinch-to-zoom disabled (game viewport should not zoom)
- [ ] **GEST-03**: Double-tap prevention (accidental zoom disabled)

### Game Modes Mobile (GM)
- [ ] **GM-01**: Classic mode fully playable on mobile with touch controls
- [ ] **GM-02**: Race mode fully playable on mobile with touch controls
- [ ] **GM-03**: Mode selection UI touch-optimized for mobile
- [ ] **GM-04**: Game pause/resume works correctly on mobile (no focus loss issues)

## Future Requirements (v2.4+)

### Advanced Mobile Features (deferred)
- [ ] **ADV-01**: Haptic feedback (vibration on collisions, boost)
- [ ] **ADV-02**: Mobile-specific achievements/goals
- [ ] **ADV-03**: PWA support for "Add to Home Screen"
- [ ] **ADV-04**: Native wrapper (Capacitor/Cordova) for app store distribution

## Out of Scope

- **App store packaging** — PWA or native wrapper is future scope
- **Mobile-specific game modes** — Classic and Race modes only
- **Mobile multiplayer** — Uses existing desktop online multiplayer
- **Advanced haptics** — Basic vibration only in v2.3
- **Mobile analytics** — Not tracking mobile-specific metrics in v2.3
- **Push notifications** — Not needed for this game type

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RL-01 | Phase 1 | Pending |
| RL-02 | Phase 1 | Pending |
| RL-03 | Phase 1 | Pending |
| RL-04 | Phase 1 | Pending |
| RL-05 | Phase 1 | Pending |
| RL-06 | Phase 1 | Pending |
| TC-01 | Phase 2 | Pending |
| TC-02 | Phase 2 | Pending |
| TC-03 | Phase 2 | Pending |
| TC-04 | Phase 2 | Pending |
| TC-05 | Phase 2 | Pending |
| TC-06 | Phase 2 | Pending |
| MUI-01 | Phase 3 | Pending |
| MUI-02 | Phase 3 | Pending |
| MUI-03 | Phase 3 | Pending |
| MUI-04 | Phase 3 | Pending |
| MUI-05 | Phase 3 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| PERF-05 | Phase 4 | Pending |
| GEST-01 | Phase 5 | Pending |
| GEST-02 | Phase 5 | Pending |
| GEST-03 | Phase 5 | Pending |
| GM-01 | Phase 5 | Pending |
| GM-02 | Phase 5 | Pending |
| GM-03 | Phase 5 | Pending |
| GM-04 | Phase 5 | Pending |

*Phase mapping completed by roadmapper for v2.3 milestone.*

---
*Created: 2026-04-28 for v2.3 Mobile Support milestone*
