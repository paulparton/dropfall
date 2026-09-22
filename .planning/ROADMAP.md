# Roadmap: Dropfall Arena v4.0

## Phase 12: Combat Foundation

**Mode:** mvp

**Goal:** As a local player, I want precise movement, boost timing, and dependable collisions so that every ring-out feels earned and I immediately want a rematch.

**Requirements:** COMBAT-01, COMBAT-02, COMBAT-03, COMBAT-04

**Success Criteria:**
1. Movement responds instantly, preserves momentum, and remains controllable at arena edges.
2. Boost exposes readiness state and cannot be spammed or silently fail.
3. Collisions scale knockback with closing speed and retain counter-play.
4. Simultaneous and individual ring-outs resolve once with predictable scoring.
5. The editor target compiles cleanly and a full first-to-three PIE match completes without gameplay errors.

## Phase 13: Local Match Experience

**Goal:** Make couch versus and versus AI start instantly and play cleanly with keyboard or controllers.

**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, LOCAL-04, MATCH-01, MATCH-02, MATCH-03, MATCH-04

**Success Criteria:**
1. One-player versus AI and two-player couch matches require no menus or restarts to switch.
2. Keyboard and two standard controllers can independently move and boost fighters.
3. HUD and camera communicate all actionable state at a glance.
4. Round transitions lock input, reset cleanly, and reach rematch without stale state.

## Phase 14: AI Ladder

**Goal:** Create a three-rung solo ladder that teaches positioning and increasingly credible ring-out tactics.

**Requirements:** AI-01, AI-02, AI-03, AI-04

**Success Criteria:**
1. Rookie, Rival, and Ace are selectable and visibly identified.
2. Tiers differ through reaction/decision quality, not hidden movement or mass advantages.
3. AI attacks, recovers, and respects dangerous edges at increasing competence.
4. Local wins and streaks persist independently for each tier.

## Phase 15: Arena and Presentation Foundation

**Goal:** Establish a readable, tunable arena/content architecture for rapid design iteration.

**Requirements:** ARENA-01, ARENA-02, ARENA-03

**Success Criteria:**
1. Arena geometry creates multiple viable approaches and preserves full visual readability.
2. Rules and arena configuration are data-driven behind validated C++ contracts.
3. Presentation, input, and future transport can change without rewriting authoritative rules.
4. Hit, boost, ring-out, round, and win feedback form a cohesive presentation pass.

## Phase 16: Product Integrity and Release Seams

**Goal:** Lock competitive, monetization, validation, and storefront boundaries before online expansion.

**Requirements:** PROD-01, PROD-02, PROD-03

**Success Criteria:**
1. Runtime policy makes active-play ad placement impossible.
2. Paid entitlement disables all ad opportunities through one stable interface.
3. Combat and match invariants run in automated/headless validation.
4. Steam-facing build settings and future authoritative-server seams are documented and enforced.

## Progress

| Phase | Status | Requirements | Progress |
|-------|--------|--------------|----------|
| 12. Combat Foundation | In Progress | 4 | 0% |
| 13. Local Match Experience | Pending | 8 | 0% |
| 14. AI Ladder | Pending | 4 | 0% |
| 15. Arena and Presentation Foundation | Pending | 3 | 0% |
| 16. Product Integrity and Release Seams | Pending | 3 | 0% |

---
*Roadmap created: 2026-09-22*
