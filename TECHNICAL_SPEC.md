# Dropfall — Production Technical Specification

**Document status:** implementation baseline and production target  
**Product:** Dropfall: Cyber Arena  
**Target:** premium-quality, complete competitive arena game for web and desktop  
**Current stack constraint:** Three.js, Rapier3D, Zustand, Vite, Node.js, WebSocket

## 1. Executive summary

Dropfall is a two-player physics arena game in which players control momentum-driven spheres on a destructible hex platform. Players collect temporary power-ups, use a rechargeable boost, and attempt to knock the opponent into the void. A match is first to three round wins. The product supports solo play against AI, local multiplayer, authoritative online multiplayer, custom arenas, themes, replays, touch, gamepad, keyboard, and XR.

The production version should preserve the immediate readability of the prototype while making every action legible, responsive, and competitively trustworthy. “AAA” in this specification means a high bar for interaction quality, frame pacing, feedback, accessibility, reliability, content consistency, and operational support. It does not mean copying the content volume or team size of a large boxed release.

### Product pillars

1. **Readable chaos.** Destruction and effects must create tension without hiding player intent or safe ground.
2. **Momentum mastery.** Movement should be learnable in one round and support advanced positioning, feints, boost timing, and recovery.
3. **Instant rematch energy.** Setup, matchmaking, round transitions, and rematches must be fast.
4. **Competitive trust.** Online outcomes come from an authoritative simulation with visible connection health and deterministic match rules.
5. **Broad playability.** Keyboard, controller, touch, reduced-motion preferences, lower-power hardware, and safe-area screens are first-class.

## 2. Scope and release definition

### 2.1 Complete v1 product

- Solo duel against Easy, Normal, and Hard tactical AI.
- Two-player local duel with independent keyboard or controller input.
- Two-player online private lobbies with ready-up, reconnect grace, rematch, and server authority.
- First-to-three classic knockout matches.
- Curated arena roster using the existing level data format.
- Player name, color, and hat customization.
- Boost, collapsing tiles, ice tiles, and the existing data-driven power-up set.
- Five coherent visual themes: Cyber, Beach, Temple, Arctic, and Inferno.
- Round replay, session win/loss record, settings presets, and persistent preferences.
- Responsive HUD, pause for offline modes, safe local input recovery, and graceful WebGL/audio/network failure messaging.
- Web deployment plus installable desktop packages where packaging is maintained.

### 2.2 Post-v1 content

- Ranked matchmaking, accounts, progression, cosmetics economy, global leaderboards, spectator mode, tournaments, and anti-cheat telemetry.
- Four-player arenas and team modes.
- Full racing campaign, ghosts, and time trials.
- Console certification and native mobile packaging.
- User-generated level publishing and moderation.

These are expansion tracks, not requirements for the first complete competitive release.

## 3. Player experience specification

### 3.1 Core loop

1. Choose Solo, Local, or Online.
2. Select arena and customize competitors.
3. Enter a three-second synchronized countdown.
4. Navigate safe tiles, collect power-ups, build boost, and create a favorable collision.
5. Knock the opponent out or survive their fall.
6. Show the result, preserve the visual winner moment, and offer replay/next round.
7. End at three wins and offer immediate rematch or return to command center.

### 3.2 Movement and combat contract

- Directional input applies camera-relative force on the horizontal plane.
- Boost consumes a visible resource and creates a clear acceleration, trail, sound, and collision threat state.
- Input-to-physics latency target is under 50 ms locally and under 100 ms perceived online under target network conditions.
- Collision strength scales with relative velocity and boost state.
- Players must always be able to distinguish normal movement, boost, power-up state, hit confirmation, danger, and elimination.
- A player may not spawn on an invalid tile, inside another player, or inside a lethal state.
- Round resolution freezes simulation once an outcome is authoritative; no post-result reversal is permitted.

### 3.3 Match rules

- Default format: first to 3 round wins.
- Countdown: 3 seconds; movement locked until `PLAYING`.
- Simultaneous elimination resolves as a draw unless the authoritative simulation has already recorded a valid earlier elimination.
- Arena and physics settings are immutable after ready-up online.
- Offline pause freezes gameplay and simulation. Online play never pauses the server; loss of focus displays status but does not create an advantage.

### 3.4 Feedback hierarchy

Priority from highest to lowest:

1. Player position, opponent position, arena edge, and safe/unsafe tiles.
2. Knockout, high-impact collision, boost availability, and active power-ups.
3. Score, countdown, round status, and network state.
4. Theme ambience and decorative effects.

No lower-priority effect may obscure a higher-priority signal. Bloom, particles, shake, lightning, and screen flashes require bounded intensity and reduced-motion alternatives.

## 4. UX and accessibility

### 4.1 Screen map

`Boot → Command Center → Player Setup → Countdown → Match → Round Result → Match Result`

Online branches through `Connect → Lobby → Ready Room`, while Settings is reachable from Command Center. Offline Match additionally exposes Pause.

### 4.2 Input

- Keyboard defaults: P1 WASD + Left Shift; P2 arrows + Right Shift.
- Controller defaults: left stick/D-pad + any conventional face/trigger boost binding.
- Touch: continuous directional zones or virtual stick plus a dedicated boost action.
- Clear held input on blur, visibility loss, controller disconnect, and touch cancellation.
- Prevent browser scrolling for bound gameplay keys while a match owns focus.
- All menu actions are keyboard focusable with visible focus state and meaningful accessible names.

### 4.3 Accessibility requirements

- WCAG AA contrast for essential UI text and controls.
- UI remains functional at 200% browser zoom and at 320 CSS px width.
- Do not encode player identity or tile danger by color alone; pair with labels, patterns, shape, or animation.
- Honor `prefers-reduced-motion` for menu animation, transitions, pulsing, shake, and nonessential particles.
- Volume controls for music and effects, with mute reachable in at most two actions.
- Configurable controls, dead zone, and vibration toggle before console/mobile certification.
- Countdown and elimination signals use both visual and audio cues.

## 5. Content and visual direction

### 5.1 Art direction

The visual language is “broadcast cyber sport”: dark high-contrast arenas, precise luminous geometry, restrained glass UI, condensed athletic typography, and strong team-color accents. Effects should feel electrical and kinetic rather than noisy. Each environment theme changes sky, surface response, ambience, and tile warning treatment while preserving identical competitive readability.

### 5.2 Arena content rules

- Every arena declares stable ID, display name, version, supported modes, tile set, spawns, theme, preview metadata, and optional rule overrides.
- Spawns require equal distance to center, equivalent escape options, and a valid connected safe path.
- Competitive arenas must pass automated connectivity, symmetry/fairness, spawn clearance, and minimum-safe-tile checks.
- Each arena needs a 16:9 thumbnail, short tactical description, difficulty tag, and versioned checksum for online parity.
- Curated release target: 6–10 duel arenas across at least three tactical archetypes (open, segmented, hazardous).

### 5.3 Audio

- Adaptive music moves between menu, countdown, match, final point, and result energy states.
- SFX buses: UI, movement, boost, collision, destruction, power-up, announcer, ambience.
- Collision pitch/loudness derives from impact energy with limiting to prevent spikes.
- Important competitive sounds use concurrency limits and priority-based voice stealing.
- Audio must recover cleanly after browser suspension and retain mixer preferences.

## 6. Technical architecture

### 6.1 Target module boundaries

```text
Application shell
├── FlowController          screen and match state transitions
├── MatchController         rules, countdown, scoring, round lifecycle
├── EntityManager           player/arena/effect ownership and cleanup
├── InputSystem             keyboard, gamepad, touch, rebinding
├── Simulation
│   ├── PhysicsSystem       fixed-step Rapier world
│   ├── CombatSystem        collision and knockback resolution
│   └── ArenaSystem         tile state machine and hazards
├── Presentation
│   ├── Renderer            Three.js, lighting, post processing, quality
│   ├── CameraDirector      gameplay/result/replay cameras
│   ├── VFX pools           particles, lightning, shockwaves
│   ├── AudioSystem         mixer and adaptive score
│   └── UI                  DOM components and accessibility
├── NetworkClient           protocol, prediction, reconciliation
├── ReplaySystem            capture, playback, export metadata
└── Telemetry               performance and fault events
```

The existing `src/main.js` remains the composition root during incremental migration. New behavior should move behind testable systems instead of enlarging it indefinitely. The experimental SDF renderer is not part of the shipping path and should be removed from release bundles or isolated as R&D.

### 6.2 State model

Valid primary states:

```text
BOOT
MENU
PLAYER_SETUP
ONLINE_CONNECT
ONLINE_LOBBY
ONLINE_READY
COUNTDOWN
PLAYING
ROUND_OVER
GAME_OVER
ERROR
```

Pause is an offline presentation/simulation overlay, not a network match state. All state transitions should be issued through explicit actions and validated in development builds. Match configuration is snapshotted at start and must not read mutable menu settings mid-round.

### 6.3 Simulation

- Rapier fixed step: 60 Hz desktop/server; mobile may render at 30 Hz but should retain a stable simulation cadence where hardware permits.
- Clamp accumulated time after backgrounding; never simulate an unbounded catch-up burst.
- Use interpolation for rendering between fixed states.
- Collision groups separate players, arena, triggers, decorations, and editor-only objects.
- Server and client share rule constants and schema validation.
- Seed all gameplay-affecting randomness per match so replay and debugging can reproduce tile/power-up sequences.

### 6.4 Rendering and performance

Targets:

| Platform class | Resolution target | Frame target | 1% low | GPU budget |
| --- | --- | ---: | ---: | ---: |
| Desktop recommended | 1080p–1440p | 60 fps | 50 fps | 14 ms |
| Desktop minimum | 720p | 60 fps | 45 fps | 14 ms |
| Mid-range mobile | native CSS size, scaled buffer | 30 fps | 24 fps | 28 ms |
| XR | headset recommended | 72/90 fps | platform | platform |

- Cap device pixel ratio and dynamically reduce internal resolution after sustained frame misses.
- Mobile disables bloom and uses reduced shadows/effect density.
- Reuse geometry and materials; pool transient effects; avoid per-tile dynamic lights.
- Bound particle count and collision effect concurrency.
- Pause/offscreen states stop simulation work and reduce decorative update rate.
- Record rolling frame time, dynamic resolution scale, draw calls, triangles, physics time, and network RTT in the diagnostics overlay.

### 6.5 Network model

- Server runs authoritative 60 Hz physics and publishes snapshots at 20 Hz or an empirically tuned rate.
- Client sends sequenced normalized input; server clamps rate and validates values.
- Local player uses prediction and reconciliation; remote player uses buffered interpolation.
- Match messages include protocol version, match ID, server tick, acknowledged input tick, and configuration checksum.
- Reconnect grace default: 15 seconds with a signed resume token.
- Server rejects invalid settings, impossible input frequency, stale match IDs, and oversized payloads.
- Transport uses WSS in production with origin allowlisting, rate limits, heartbeat, and bounded queues.
- Do not allow client-reported position, score, tile outcome, or winner to override authority.

### 6.6 Data formats

All external data is schema-validated with Zod and versioned.

- `LevelDefinition`: identity, version, theme, tiles, spawns, checkpoints, rules, preview.
- `MatchConfig`: mode, arena checksum, rules, physics tuning, cosmetic selections, seed.
- `InputFrame`: match ID, sequence, client tick, direction vector, boost bit.
- `WorldSnapshot`: server tick, ack, players, changed tiles, power-ups, score, state.
- `ReplayHeader`: build, protocol, config, seed, players, timestamp.
- `ReplayFrame`: input stream plus authoritative correction/keyframes.

Migrations must preserve previously shipped settings and levels or provide a clear compatibility error.

## 7. Reliability, security, and operations

- Initialization failures display a branded recovery panel with diagnostic code and retry action.
- Handle WebGL context loss/restoration, audio suspension, storage denial, and network loss.
- Client logs are disabled by default in production and use leveled structured diagnostics when enabled.
- Sanitize player/preset names and render user text through `textContent`.
- HTTP server sets CSP, frame policy, MIME protections, referrer policy, and cache headers for hashed assets.
- Health endpoint reports process readiness; a separate deeper diagnostic may report physics initialization.
- Match rooms and disconnected sessions have hard TTLs.
- Deployments support rollback and do not mix incompatible client/server protocol versions.
- Telemetry must avoid personal data by default and document retention.

## 8. Testing strategy

### 8.1 Automated gates

- Unit: store transitions, rules, collision math, boost economy, power-up apply/remove, AI decisions, input clearing, schemas.
- Integration: physics world plus entities, level loading, seeded arena evolution, replay round-trip, server room lifecycle.
- Browser E2E: boot, all three mode entry paths, customization, countdown, movement, pause/resume, round resolution, rematch, settings persistence.
- Network E2E: two headless clients, ready-up, authoritative movement, packet delay/loss simulation, reconnect, host disconnect.
- Visual regression: command center, setup, HUD, pause, result, settings at desktop/tablet/mobile sizes and all themes.
- Performance: 5-minute bot match on minimum profiles with frame-time and memory thresholds.
- Soak: server room churn plus long-running matches for leaks and orphaned timers.

### 8.2 Release acceptance

- No P0/P1 defects and no known exploit that changes authoritative outcomes.
- 99% crash-free browser sessions in staged traffic.
- Target frame rate met for at least 95% of active match time on reference devices.
- Online match completion above 98% excluding intentional leaves.
- No input remains stuck after blur, visibility change, disconnect, or pause.
- All primary flows operable using keyboard only.
- Production build, unit suite, browser smoke suite, health check, and two-client network suite pass from a clean checkout.

## 9. Delivery plan

### Phase A — polished vertical slice (implemented)

- Production command-center hierarchy and responsive visual system.
- Broadcast-style readable HUD and result presentation.
- Offline pause/resume/restart/menu flow.
- Input reset on focus loss, fixed touch directions, and gameplay key ownership.
- Automatic desktop render-resolution governor with performance metrics.
- Existing solo/local/online gameplay, AI, levels, customization, themes, replay, and XR retained.
- Shared pre-match match-settings schema across offline UI, online rooms, client state, and server validation.
- Live online settings picker lifecycle with random initial selection and previous-match-loser selection.
- Curated arena launch validation, deterministic safe spawns, preview thumbnails, and perimeter-collapse pacing.
- Arena-aware gameplay/victory cameras, polished countdown, identity color preservation, and authoritative power-up selection.
- Root static-route MIME correction and safe path resolution.

### Phase B — architecture and hardening

- Extract flow, match, entity, camera, and combat controllers from `main.js`.
- Remove duplicate/experimental shipping paths and production console noise.
- Centralize safe storage and user-input sanitation.
- Version shared protocol/rule contracts and add two-client network tests.
- Add branded initialization/error recovery and WebGL context restoration.

### Phase C — content complete

- Curate and balance the release arena roster.
- Complete theme-specific VFX/audio treatment and accessibility variants.
- Add tutorial challenges and first-session coaching.
- Finish visual, audio, and performance regression matrices on reference devices.

### Phase D — launch readiness

- Security headers, abuse limits, observability, alerting, load/soak testing, rollback drill.
- Store assets, legal/privacy copy, support runbooks, patch/version policy.
- Closed beta metrics, balance iteration, release candidate, and staged public rollout.

## 10. Implementation matrix

| Capability | Current repository after this pass | Remaining production work |
| --- | --- | --- |
| Core duel and scoring | Implemented | Balance and deterministic rules audit |
| Solo AI | Implemented, three difficulties | Behavior tests and tuning telemetry |
| Local multiplayer | Implemented | Device matrix and controller assignment UX |
| Authoritative online | Picker lifecycle, live rules, readiness, reconnect baseline, and server simulation implemented | Protocol versioning, adverse-network E2E, load and abuse hardening |
| Arena/themes/power-ups | Five validated release arenas, paced collapse, timed ice, and server-selected power-ups | Additional balanced content and seeded determinism |
| Customization/setup | Unified offline flow; online uses the shared rule schema and full cosmetic roster | Cosmetic asset production and final accessibility audit |
| Replay | Implemented round replay | Versioned deterministic replay/export |
| Command center/HUD/result | Production visual pass implemented | Visual regression and localization |
| Offline pause and focus safety | Implemented | Controller-driven pause navigation |
| Adaptive rendering | Implemented desktop governor/mobile baseline | Reference-device performance certification |
| Accessibility | Responsive/focus/reduced-motion baseline | Full audit, non-color danger language, remapping UX |
| Operations | Health/deployment baseline | Telemetry, alerting, rollback and load certification |

The implementation matrix intentionally distinguishes a polished, playable build from the remaining multidisciplinary work required to claim a commercially certified AAA release.
