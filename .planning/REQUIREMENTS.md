# Requirements: Dropfall Arena Foundation

**Defined:** 2026-09-22
**Core Value:** Every round creates an immediate, legible contest of movement, timing, positioning, and ring-outs.

## v4.0 Requirements

### Combat

- [x] **COMBAT-01**: Player movement responds immediately while preserving physical momentum and counter-play.
- [x] **COMBAT-02**: Players can boost in their intended direction with a clearly communicated cooldown.
- [x] **COMBAT-03**: Player collisions create readable, speed-dependent knockback without random one-touch outcomes.
- [x] **COMBAT-04**: Falling beyond the arena boundary produces a reliable ring-out and deterministic round result.

### Local Play

- [x] **LOCAL-01**: One player can begin a versus-AI match without setup friction.
- [x] **LOCAL-02**: Two players can complete a couch-versus match on one machine.
- [x] **LOCAL-03**: Local players can use keyboard or standard gamepads with clear control prompts.
- [x] **LOCAL-04**: Players can switch opponent mode and restart a match without restarting the application.

### AI Ladder

- [x] **AI-01**: Player can select Rookie, Rival, or Ace AI from the playable match.
- [x] **AI-02**: Each AI tier uses distinct reaction, aim, aggression, and recovery behavior without privileged physics.
- [x] **AI-03**: AI protects itself near an edge and can intentionally set up a ring-out attack.
- [x] **AI-04**: Player progress records wins and best streak per AI tier locally.

### Match Experience

- [x] **MATCH-01**: HUD communicates score, opponent mode/tier, boost readiness, round result, and match winner.
- [x] **MATCH-02**: First-to-three rounds reset quickly and never accept gameplay input during transition.
- [x] **MATCH-03**: Rematch flow returns both fighters and match state to a known clean state.
- [x] **MATCH-04**: Camera keeps the actionable arena and both fighters readable throughout a round.

### Arena Foundation

- [x] **ARENA-01**: The first arena contains purposeful geometry that creates positioning choices without obscuring play.
- [x] **ARENA-02**: Arena dimensions, spawn points, hazards, score target, and tuning can move into data assets without changing match code.
- [x] **ARENA-03**: Runtime code separates authoritative rules from local input, presentation, and future transport.

### Product Integrity

- [x] **PROD-01**: Ads and monetization prompts are forbidden while a round or match is active.
- [x] **PROD-02**: A paid entitlement contract can disable all advertising without changing gameplay state.
- [x] **PROD-03**: Competitive gameplay tuning is covered by automated or headless validation where practical.

## Future Requirements

### Online Competition

- **ONLINE-01**: Players can join authoritative casual and ranked online matches.
- **ONLINE-02**: Ranked results feed authenticated seasonal leaderboards.
- **ONLINE-03**: Replays and server validation support disputes and cheat detection.

### Creation and Community

- **CREATE-01**: Players can build arenas from validated modular parts.
- **CREATE-02**: Creators can test, validate, publish, and version arenas.
- **COMM-01**: Players can browse curated and community arena rotations.

### Commercial Release

- **STORE-01**: Steam entitlement permanently disables advertising.
- **STORE-02**: Free builds show only restrained menu/intermission placements with frequency caps.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ranked online play in v4.0 | Local simulation and match feel must stabilize first |
| Global leaderboard in v4.0 | Requires identity, backend authority, and anti-cheat |
| Production ad provider in v4.0 | Policy and entitlement seam precede vendor integration |
| Full art production | Greybox/readability validation comes before expensive content |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMBAT-01, COMBAT-02, COMBAT-03, COMBAT-04 | Phase 12 | Complete |
| LOCAL-01, LOCAL-02, LOCAL-03, LOCAL-04 | Phase 13 | Complete |
| AI-01, AI-02, AI-03, AI-04 | Phase 14 | Complete |
| MATCH-01, MATCH-02, MATCH-03, MATCH-04 | Phase 13 | Complete |
| ARENA-01, ARENA-02, ARENA-03 | Phase 15 | Complete |
| PROD-01, PROD-02, PROD-03 | Phase 16 | Complete |

**Coverage:** 22 v4.0 requirements | 22 mapped | 0 unmapped ✓

---
*Requirements defined: 2026-09-22*
*Last updated: 2026-09-22 after first-draft verification*
