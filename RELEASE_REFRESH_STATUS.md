# Dropfall Release Refresh — Implementation Status

Updated: 27 July 2026

This document records what was implemented from
`DROPFALL_RELEASE_REFRESH_SPEC.md`, what is demonstrably working, and what
still gates a commercial Steam, iOS, Android, and web release.

## Current milestone

Dropfall now has a release-quality foundation and a playable vertical slice of
the refresh. It is not yet a finished multi-store release. Core consistency,
security, creator, profile, scoreboard, power-up, monetization-policy, and
responsive-shell work is implemented; external services, platform SDKs, final
3D cosmetic production, content scale, and certification remain.

## Implemented

### One game contract

- Shared match constants now drive local and online match wins, countdowns,
  round delays, and reconnect grace periods.
- The client and authoritative server use the same eight power-up definitions
  and modifiers.
- Network messages are versioned and schema-validated.
- Local, online, creator test-play, and presentation surfaces use the same
  terminology and canonical data sources.

### Security and online foundation

- Strict WebSocket message validation, a 16 KB message cap, rate limiting,
  heartbeat cleanup, protocol-version checks, and signed reconnect tokens.
- Origin allowlisting, exact CORS behavior, security headers, CSP, HTTP
  timeouts, and production-safe developer/editor routes.
- Server-authoritative room results feed a signed, idempotent match-event
  store. Clients cannot submit their own score totals.
- Admin/editor stored-XSS paths and the customization player-name injection
  path were removed.
- Production and development dependency audits report zero known
  vulnerabilities.

### Bundled level creator

- The creator is a first-class in-game screen rather than a separate user
  journey.
- Players can paint and erase normal, ice, and bonus hex tiles; set height,
  radius, theme, difficulty, title, and description; save a local draft;
  import/export JSON; start a new layout; and test immediately in solo play.
- Creator documents use the same strict shared schema on client and server.
- Publishing accepts experimental layouts, including disconnected decorative tiles;
  launch validation is advisory rather than a publication gate.

### Profiles and scoreboards

- Up to eight local guest profiles with editable names, selected cosmetics,
  durable local stats, profile switching, and idempotent match recording.
- A local scoreboard derived from local profile results.
- A server-verified, explicitly unranked online scoreboard derived from
  authoritative match results.
- Account creation, linking, and recovery UI is intentionally capability-gated
  until a production identity provider and deletion workflow are configured.

### Art direction vertical slice

- A curated canonical eight-hat launch catalog replaces scattered emoji/name
  lists and removes the least legible novelty silhouettes from the player
  selector.
- Every available hat has a distinct 256×256 transparent, production-style
  inventory portrait and a recognizable polished procedural model in play.
- Legacy saved hat IDs migrate to the closest current design instead of
  producing missing or placeholder cosmetics.
- All eight power-ups have authored SVG iconography and a common sci-fi arcade
  visual language.
- Asset validation checks catalog IDs, paths, image dimensions, and model
  readiness.

### Monetization and platform shell

- One-binary product policy: Steam is premium/ad-free; web, iOS, and Android
  are ad-supported with a remove-ads entitlement.
- Entitlements must be verified before ad-free state is granted.
- Ads are permitted only after eligible offline matches, every third
  completion, with consent. They are forbidden during play, online sessions,
  rematches, child-directed use, or when ad-free is active.
- Purchase/restore UI is capability-gated until store adapters and
  server-side receipt validation exist.
- A web manifest, application metadata, and favicon provide the initial PWA
  shell.

### UX and verification

- Desktop and 390×844 mobile flows were exercised in a real browser.
- Verified paths include main menu, profile creation/editing, creator
  painting/save/test-play, online lobby/setup, cosmetic selection, and mobile
  responsive layout.
- Per-frame physics log spam is off by default and available behind an
  explicit local developer flag.
- Release-foundation checks are repeatable with:

  ```sh
  npm run check:release-foundation
  ```

  Current result: 26 test files and 304 tests pass, all eight launch hats and
  all eight power-ups pass asset validation, production builds, and
  `npm audit` reports zero vulnerabilities.

## Commercial-release gates

These are required before calling Dropfall store-ready:

1. **Identity and data service**
   - Choose and integrate a production identity provider.
   - Add verified account linking, recovery, logout-all-sessions, data export,
     account deletion, guest-to-account merge, and age/consent handling.
   - Replace the local JSON event store with managed PostgreSQL or an
     equivalent durable service; add backups, migrations, retention, privacy
     controls, moderation, and display-name uniqueness rules.

2. **Competitive online**
   - Add authenticated player IDs, seasons, ranked queues/rating, anti-cheat
     telemetry, reporting/blocking, moderation tools, region strategy, and
     reconnect/load/soak tests with real clients.
   - Keep the current board labelled unranked until these controls exist.

3. **Final art and content**
   - Decide whether to retain the polished procedural launch set or replace it
     with authored GLB/LOD models after device profiling; validate attachment,
     clipping, and readability for every supported player scale.
   - Expand beyond the curated eight hats only with equally recognizable
     silhouettes and completed portraits. Complete VFX, animation polish,
     coherent arena set, tutorials, progression rewards, music/SFX mix,
     localization, screenshots, trailers, capsules, and store-page assets.
   - Define device GPU tiers and reduce/code-split the current large physics
     and rendering bundles.

4. **Ads and commerce**
   - Select compliant ad and analytics providers.
   - Implement App Store, Google Play, Steam, and web checkout adapters plus
     server-side receipt validation and restore.
   - Complete GDPR/UK GDPR/CCPA consent, child-directed-mode policy, ATT where
     applicable, privacy policy, terms, data-safety disclosures, and regional
     ad behavior.

5. **Platform packaging**
   - Produce signed Steam, iOS, and Android shells/installers, controller and
     touch mappings, suspend/resume behavior, offline entitlement handling,
     achievements/cloud saves as scoped, and store-specific QA.
   - Complete Steamworks, App Store Connect, and Play Console setup,
     certification, age ratings, accessibility declarations, crash reporting,
     staged rollouts, rollback procedures, and support operations.

6. **Release QA**
   - Resolve or formally baseline the legacy lint debt.
   - Add visual regression, accessibility, controller, device-matrix, low-end
     GPU, network impairment, two-real-client, soak, capacity, payment,
     entitlement, privacy, and deletion-path tests.
   - Run closed external playtests and tune onboarding, match pacing,
     retention, difficulty, readability, and power-up balance from evidence.

## Recommended next execution order

1. Identity provider plus production database and guest-account merge.
2. Store/ad sandbox integrations with receipt validation and consent.
3. Two authored GLB hat vertical slices, performance budgets, and the final
   asset pipeline before producing the remaining cosmetics.
4. Signed platform shells and a representative device/controller test matrix.
5. Content-complete beta, external playtest, balance pass, certification, and
   staged launch.
