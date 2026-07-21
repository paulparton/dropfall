# Dropfall Launch Readiness Report

**Assessment date:** 17 July 2026  
**Build status:** release-candidate quality; deployment and certification work remains  
**Execution brief:** `FULL_LAUNCH_POLISH_PROMPT.md`

## Executive outcome

This pass moves Dropfall from a visually promising prototype to a coherent release candidate. Solo and local setup now share the same player flow and pre-match rule editor. Online rooms use the same match schema, synchronize edits live, lock non-pickers read-only, and hand the next settings pick to the previous match loser. The launch arena browser now contains only validated battle maps. Gameplay has safer spawns, arena-aware cameras, a clearer countdown, more legible identity treatment, paced perimeter collapse, expiring ice, and authoritative online power-up selection.

This is not yet a responsibly certifiable commercial launch build. The code gates are green, but the live deployment still runs the previous server build, the shipping bundle is large, the repository's legacy lint configuration is not a usable gate, and controller/XR/adverse-network/load matrices still require real-device certification.

## Implemented in this pass

### One pre-match language

- Centralized themes, defaults, ranges, formatting, presets, and server validation in `shared/matchSettings.js`.
- Added the same complete match-rule editor to single-player and local multiplayer setup.
- Online picker and spectator views render from the shared schema and exact preset catalog.
- Aligned the online cosmetic roster with offline colors, patterns, hats, and 20-character names.
- Removed unsafe preset-name HTML rendering.

### Complete online room lifecycle

- Randomly selects the first settings picker after two players join.
- Only the selected player can edit; all edits stream live to the opponent.
- Settings edits revoke stale ready states and are flushed before ready-up.
- Match loser selects the following match's rules.
- Rematches return both players to the setup room instead of auto-starting.
- Picker identity survives reconnect and remains independent of host migration.
- Server validates all incoming match settings against the shared contract.

### Playable release arenas

- Added shared launch validation for mode, tile bounds, coordinate validity, connectivity, supported abilities, and safe spawn pairs.
- Hidden invalid, private, race-only, disconnected, and one-tile editor maps from the release selector.
- Curated the visible roster to Default Arena, Classic Arena, Ice Ring, Labyrinth Run, and Tiny Duel.
- Added real preview data and replaced prototype “DEMO” presentation with official arena treatment.
- Replaced extreme-edge random spawns with deterministic, supported, separated spawn selection.
- Scaled tile loss by arena population and made collapse contract inward from the perimeter.

### Gameplay and presentation polish

- Camera now frames the fight midpoint and scales with arena size.
- Victory camera no longer clips inside the winning sphere.
- Replaced the prototype countdown block with a restrained broadcast-sport treatment.
- Brightened setup previews and improved in-match name contrast.
- Online player colors now remain faithful to the room preview instead of being replaced by stage skins.
- Ice friction is restored when the effect expires on client and server.
- Power-up identity is selected by the authoritative server and timed gameplay modifiers now execute server-side.

### Hosting and safety

- `/` now maps to `index.html` before MIME resolution and returns `text/html`.
- Added decoded-path validation and traversal protection to static serving.
- Local root and `/index.html` responses are byte-identical.
- Level API now exposes only public, launch-ready arena data to the game selector.

## Quality evidence

| Gate | Result |
| --- | --- |
| Unit/integration suite | 252 tests across 12 files passed |
| TypeScript gate | `tsc --noEmit` passed |
| Production build | Vite build passed |
| Syntax and whitespace | Node syntax checks and `git diff --check` passed |
| HTTP smoke | `/`, `/index.html`, and `/health` passed locally on the production server |
| Two-client browser flow | connect, create, join, picker lock, live Inferno sync, dual ready, and match launch passed |
| Arena smoke | curated selector and Tiny Duel launch/play framing passed |

## Remaining launch gates

### Required before public release

1. **Deploy the current commit.** The live Railway service still reports `application/octet-stream` for `/`, proving it has not received this server fix. The local production server returns the correct `text/html` response.
2. **Run adverse-network and reconnect E2E.** Add latency, jitter, packet loss, disconnect/rejoin, and host-loss coverage against deployed infrastructure.
3. **Run controller, touch, and XR certification on hardware.** Browser simulation cannot certify dead zones, haptics, safe areas, headset performance, or controller ownership.
4. **Run load and soak tests.** Validate room churn, reconnect timers, memory, physics-world cleanup, and long-running process health.
5. **Complete security/operations setup.** Add production origin allowlisting, abuse/rate limits, CSP and related headers, protocol version enforcement, telemetry, alerting, and rollback rehearsal.

### Important follow-up

- The compressed Rapier physics chunk is roughly 830 kB and should be lazy-loaded behind the command center or cached with a deliberate loading experience.
- The ESLint setup currently emits thousands of legacy type-aware errors across plain JavaScript; it needs a scoped flat configuration before lint can become a release gate.
- Complete formal visual regression at 320 px, tablet, 1080p, 1440p, reduced motion, 200% zoom, and all five themes.
- Add seeded arena randomness and replay/config checksums for deterministic competitive diagnostics.
- Continue extracting flow, camera, match, and combat responsibilities from `src/main.js`.

## Release decision

**Recommended status: Release Candidate / closed beta.** The core product, setup consistency, curated arenas, gameplay presentation, and two-player lobby flow are substantially improved and working. Promote to public launch only after the five required gates above pass on the deployed build.
