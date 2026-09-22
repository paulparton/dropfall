---
name: Dropfall Arena
version: v4.0
type: brownfield-rewrite
created: 2026-09-22
updated: 2026-09-22
---

# Dropfall Arena

## What This Is

Dropfall Arena is the native Unreal evolution of Dropfall: a fast, readable physics arena game that works immediately as local party play and rewards enough mastery to support serious competitive play. Dropfall Classic remains the web edition and design reference; Arena is a clean gameplay implementation rather than a line-for-line port.

## Core Value

Every round must create an immediate, legible contest of movement, timing, positioning, and ring-outs that is fun on the first match and remains skillful after hundreds.

## Business Context

- **Customer**: Party-game players, competitive arena players, and community event organizers.
- **Revenue model**: Free-to-play with restrained ads outside active play; any paid storefront entitlement permanently removes ads.
- **Success metric**: Players voluntarily rematch, progress through the AI ladder, and can trust competitive results.
- **Strategy notes**: Ship local multiplayer and local AI quality before online services; preserve authoritative simulation boundaries from day one.

## Current Milestone: v4.0 Arena Foundation

**Goal:** Turn the Unreal greybox into a replayable local combat vertical slice with responsive controls, couch play, an AI ladder, clear match flow, and foundations that will not be discarded for online play.

**Target features:**
- Responsive physics combat with readable boost timing and reliable ring-outs.
- Keyboard and controller-ready couch versus plus local versus AI.
- Three-step AI ladder with distinct, visible difficulty behavior.
- Clear HUD, round transitions, rematch flow, and local progress records.
- Data-driven arena/gameplay seams and automated validation for later ranked authority.

## Requirements

### Validated

- ✓ Dropfall's ball-on-arena ring-out loop is fun in local play — Dropfall Classic.
- ✓ First Unreal greybox boots directly into local versus AI and supports couch versus — Arena prototype.
- ✓ First-to-three scoring, reset, shared camera, and basic physics interactions function in PIE — Arena prototype.
- ✓ Ready/countdown/rematch flow and shared-camera keyboard couch input — Phase 16 aggregate checks; physical two-controller validation remains open.
- ✓ Rookie/Rival/Ace difficulty tiers with persistent per-tier records — Phase 14 implementation, Phase 16 aggregate checks.
- ✓ Tunable arena, Sudden Drop, cohesive HUD, lighting, and procedural combat feedback — v4.0 Phase 15.
- ✓ Active-play ad prohibition, paid-entitlement seam, and automated product contracts — v4.0 Phase 16.
- ✓ Camera-basis movement mapping; solo-run progression, local top-five ranking
  and save roundtrip — Phase 17 automated contracts.
- ✓ Match setup/results and couch rematch flow — Phase 17 PIE checks.
- ✓ Three larger maps, physical boost ramps, Stable/Fall Away terrain rules,
  map/rule-specific records and collision/reset contracts — Phase 18.

### Active

- [ ] Tune combat values from broader hands-on playtesting.
- [ ] Playtest large-map traversal, ramp approaches, bot navigation and falling-floor pacing before the final presentation pass.
- [ ] Replace greybox presentation with production characters, environments, music, and accessibility settings.
- [ ] Validate physical controllers, native mouse targets and a complete ladder run.
- [ ] Add settings/accessibility and cooked packaging needed for a public demo.

### Out of Scope

- Online matchmaking and ranked servers — follow after local simulation and match rules stabilize.
- Global leaderboards — local records arrive first; authenticated leaderboards require online identity and anti-cheat.
- Full creator/level-builder UI — establish validated modular arena data before exposing authoring tools.
- Production advertising SDK integration — define the policy and entitlement seam now, integrate a provider near release.
- Cosmetic economy — movement readability and competitive integrity come first.

## Context

- Unreal Engine 5.8.1 project lives in `unreal/`; C++ owns runtime rules and simulation contracts.
- Dropfall Classic remains in the repository as a feature reference. All Classic work is deferred by user instruction; see `CLASSIC-DEFERRED.md`.
- The current Arena prototype generates its level at runtime and uses engine primitives, allowing gameplay iteration without content dependencies.
- Steam is the initial native launch target, with other storefronts possible.

## Constraints

- **Engine**: Unreal Engine 5.8.1 with `BuildSettingsVersion.V7`.
- **Gameplay**: Active rounds may never show ads or monetization prompts.
- **Architecture**: Runtime gameplay cannot depend on editor Python or hand-edited `.uasset` bytes.
- **Networking**: Core rules must be deterministic enough to move behind server authority without redesigning player-facing behavior.
- **Performance**: Stable 60 fps is the minimum gameplay target on supported desktop hardware.
- **Input**: Keyboard and standard gamepads are first-class for local play.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build Arena as a clean Unreal implementation | The Classic codebase is a design sketch, not a native competitive foundation | ✓ Good |
| Prove local versus and AI before online | Fast iteration exposes whether the core loop deserves network investment | — Pending |
| Use C++ for simulation/rules and data/Blueprint seams for tuning/presentation | Supports performance, testing, designers, and future server authority | — Pending |
| Ads only in menus or between sessions; paid entitlement disables them | Revenue must not damage match enjoyment or competitive trust | — Pending |
| AI difficulty changes decisions and timing, not physics privileges | Players should learn transferable skills at every rung | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Move validated requirements to Validated with their phase reference.
2. Move invalidated requirements to Out of Scope with a reason.
3. Add newly discovered requirements and significant decisions.
4. Re-check that the product description and core value remain accurate.

**After each milestone:**
1. Review every section against shipped behavior and player feedback.
2. Re-check the core value and business context.
3. Audit deferred scope and update the technical context.

---
*Last updated: 2026-09-22 after starting v4.0 Arena Foundation*
