---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Single-Player Race Mode
status: Planning
last_updated: "2026-04-03T10:30:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Dropfall v2.2 Single-Player Race Mode

## Milestone Goal

Add a second game mode: racing with Mario Kart-style track design and ball physics.

## Current Status

- **Milestone:** v2.2 Single-Player Race Mode
- **Status:** Planning phase
- **v2.1:** Complete (Online Multiplayer Fix)
- **v2.0:** Complete (TypeScript migration, Entity System)

## Phase Status

| Phase | Status | Progress | Notes |
|-------|--------|----------|-------|
| 7: Race Mode Fundamentals | Not Started | 0% | Game state, mode selection, basic track |
| 8: Physics & Gameplay Polish | Not Started | 0% | Physics tuning, boost zones, effects |
| 9: Content & Validation | Not Started | 0% | Track finalization, mobile, UAT |

## Key Context

- Previous milestones have established solid foundation (physics, rendering, entity system)
- Reusing: existing ball mechanics, particle effects, tile rendering
- Challenge: Adapting classic mode mechanics to racing context
- Focus: Single-player experience with clear progression

## Quick Tasks Completed (v2.1 Enhancement)

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-tbn | Implement player scores tracking, replay system, and character customization | 2026-04-03 | 518d1c2 | [260403-tbn-scores-replay-customization](./quick/260403-tbn-scores-replay-customization/) |

**What was delivered:**
- Player scores overlay displayed during gameplay
- Frame-based replay recording with auto-play falling clip
- Character customization modal (12 colors × 5 hats) integrated into game flow

## Blockers & Concerns

None identified at start.

## Next Actions

1. ✓ Milestone planning started
2. **→ Define requirements** — Scope v2.1 features
3. **→ Create roadmap** — Plan phases
4. **→ Execute** — Fix the bug

## Last Updated

2026-03-31 — v2.1 milestone started

**Next:** Define requirements, create roadmap
