---
name: Dropfall Single-Player Race Mode
version: v2.2
type: brownfield
created: 2026-03-31
updated: 2026-04-01
---

# Dropfall v2.2: Single-Player Race Mode

## What This Is

Add a second game mode offering racing gameplay with Mario Kart-style dynamic track design. Reuses existing ball physics and tile mechanics from the classic Dropfall mode, but presents them in a racing context.

## Problem Statement

Classic Dropfall is a single-player survival mode where balls drop and players navigate. To expand engagement, add a racing mode that:
- Feels like Mario Kart (competitive, fast-paced, dynamic)
- Reuses existing ball physics and tile mechanics
- Offers progressive challenge through track design, not just enemy spawning
- Provides clear win conditions and progression

## Core Value

Provide players with a second distinct game mode that expands gameplay appeal while leveraging existing physics and asset systems. Racing mode celebrates speed, skill, and track mastery rather than survival duration.

## Target Features

1. **Game Mode Selection** - Menu/UI to switch between Classic and Race modes
2. **Race Track Design** - A race track with Mario Kart-inspired features (turns, jumps, speed boosts, obstacles)
3. **Racing Physics Adaptation** - Ball gravity, momentum, and speed tuned for racing (faster than survival mode)
4. **Finish Line Detection** - Clear start/finish with lap counting or checkpoint progression
5. **Race UI/HUD** - Speed indicator, lap counter, best time tracking, finish state
6. **Progressive Difficulty** - Multiple track variations with increasing challenge
7. **Performance Optimization** - Ensure racing mode runs smoothly at 60fps

## Key Context

- v2.1 just completed: fixed online multiplayer so 2 players can control their own balls
- Existing systems ready to reuse: ball physics, tile rendering, particle/visual effects
- Design philosophy: lean on Mario Kart feel (speed, curves, hazards) not pure simulation
- Single-player focus initially (multiplayer racing is future scope)

## Out of Scope

- Multiplayer racing (future milestone)
- Dynamic weather or advanced visual effects
- Advanced AI opponents or ghost racing (v1 is no opponents, just track)
- Mobile/touch controls (desktop first)
- Cross-platform networking for racing mode
- Advanced analytics or leaderboards

## Success Criteria

- [ ] Player can select Race mode from main menu
- [ ] Race track renders correctly with obstacles and visual feedback
- [ ] Ball controls feel responsive and match Mario Kart racing pacing
- [ ] Start/finish detection works, lap count updates
- [ ] Race UI displays speed, time, and lap clearly
- [ ] Multiple difficulty variations available
- [ ] 60fps maintained during gameplay
- [ ] No regression in Classic mode functionality

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
