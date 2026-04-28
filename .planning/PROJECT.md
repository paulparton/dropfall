---
name: Dropfall Mobile Support
version: v2.3
type: brownfield
created: 2026-03-31
updated: 2026-04-28
---

# Dropfall v2.3: First-Class Mobile Support

## What This Is

Add first-class mobile support to Dropfall with responsive layouts, touch screen controls, and AAA-quality mobile experience. Desktop retains the existing layout unchanged.

## Problem Statement

Dropfall currently works on desktop only. To reach a wider audience and provide a premium mobile experience, the game needs:
- Responsive layouts that adapt to mobile screen sizes while keeping desktop layout unchanged
- Touch screen controls for the main game (ball movement, interactions)
- Mobile-optimized UI/UX patterns (touch targets, gestures, viewport handling)
- Performance optimization for mobile GPUs and processors
- AAA-quality feel on mobile devices

## Core Value

Make Dropfall accessible to mobile players with a premium touch-first experience while preserving the existing desktop experience unchanged.

## Target Features

1. **Responsive Layout System** - Fluid layouts that adapt to screen size; desktop unchanged, mobile gets optimized layout
2. **Touch Screen Controls** - Virtual joystick or touch-drag controls for ball movement on mobile
3. **Mobile UI Patterns** - Touch-friendly buttons, appropriate sizing, gesture support
4. **Viewport & Orientation** - Proper viewport meta, orientation handling, safe area support
5. **Performance Optimization** - Mobile GPU optimizations, reduced particle effects, battery-friendly rendering
6. **Touch Gesture Support** - Swipe, tap, pinch gestures where appropriate
7. **Mobile HUD** - Compact, touch-accessible HUD elements for mobile screens

## Key Context

- v2.2 completed: Single-Player Race Mode (phases 7-9 archived)
- Existing systems: ball physics, tile rendering, race mode, classic mode all working on desktop
- Desktop layout must remain unchanged (media queries only affect mobile)
- Touch controls should feel native and responsive (<16ms latency)
- Performance target: 30fps minimum on mid-range mobile devices

## Out of Scope

- Mobile app store packaging (PWA or native wrapper is future scope)
- Mobile-specific game modes
- Mobile multiplayer (uses desktop online multiplayer)
- Advanced mobile haptics (basic vibration only)
- Mobile analytics or push notifications

## Success Criteria

- [ ] Desktop layout unchanged on screens >1024px
- [ ] Mobile layout activates on screens <768px width
- [ ] Touch controls allow full gameplay (ball movement, menu navigation)
- [ ] Touch latency <16ms (feels instant)
- [ ] 30fps maintained on mid-range mobile devices
- [ ] All UI elements meet 44px minimum touch target size
- [ ] Safe area insets handled (notch, home indicator)
- [ ] No regression in desktop functionality

---

## Evolution

This document evolves at milestone boundaries.

**After each phase transition:**
1. Requirements validated? → Move to Verified
2. New requirements emerged? → Add to Active
3. Key decisions to log → Add to Key Decisions

**After milestone completion:**
1. Full review of all sections
2. Success criteria audit
3. Prepare for next milestone (v2.2 or v3.0)

---

*Last updated: 2026-03-31 at v2.1 milestone start*
