# Dropfall — AAA-Quality Indie Release Refresh Specification

**Status:** Proposed product, design, art, technical, commercial, and release baseline  
**Prepared:** 27 July 2026  
**Target platforms:** Steam, iOS, Android, and web  
**Target quality:** “AAA-quality indie” — exceptional cohesion, responsiveness, readability, reliability, and finish at a deliberately controlled scope  
**Supersedes:** Earlier “production-ready” and “release candidate” claims where they conflict with current repository or runtime evidence

---

## 1. Executive decision

Dropfall has a strong, marketable core: a readable physics duel, short rounds, local rivalry, online rematches, destructible hex arenas, and an editor that can create long-term content. The current build is a promising vertical slice, not a commercial release candidate.

The refresh should **retain Three.js, Rapier, Vite, and the authoritative Node/WebSocket simulation**, but replace the prototype product architecture around them. A migration to Unity, Unreal, or another engine is not recommended unless a four-week packaging/performance spike disproves the existing stack. The problems observed are primarily fragmented flows, duplicated systems, missing production services, inconsistent assets, insufficient platform integration, and weak release operations—not an inability of the renderer or physics engine to ship the game.

The recommended launch product is:

- A polished two-player physics arena game with solo, couch, private online, and public online play.
- One shared setup and match flow across every mode.
- Eight curated power-ups with unique models, icons, audio, VFX, and gameplay language.
- Twenty rebuilt launch hats using authored PBR assets and a single cosmetic pipeline.
- Eight to twelve official launch arenas plus an in-game editor.
- Optional Dropfall accounts and profiles; accounts required only for public online rankings and publishing levels.
- Device-local records, canonical online ratings/leaderboards, and platform-native leaderboard mirrors.
- A premium, ad-free Steam edition.
- A free ad-supported mobile/web edition with a permanent ad-free upgrade.
- No pay-to-win mechanics, loot boxes, consumable power, or ads during live play.

### Release recommendation

Do not set a public release date yet. First complete a **release vertical slice** containing:

1. The final shared menu/setup flow.
2. One production arena.
3. Two production hats.
4. Two production power-ups.
5. Solo, local, and two-client online play using the same UI and gameplay definitions.
6. One account/profile, one local board, and one authoritative online board.
7. One editor create → validate → test-play → save loop.
8. One Steam build and one Capacitor mobile build on physical devices.

Approve full production only if that slice meets the performance, feel, accessibility, networking, and art gates in this document.

---

## 2. Current-state audit

### 2.1 What is already valuable

- The main menu has a distinctive neon-sport presentation and clear three-mode entry.
- The moment-to-moment arena concept is immediately understandable.
- Rapier-backed movement, boosts, falling tiles, ice, eight power-up effects, AI, replays, five themes, and server-authoritative online simulation all exist.
- The online server owns match state, physics, scoring, countdowns, and round results.
- Shared match-setting definitions and launch-level validation have begun to reduce drift.
- The editor can create, load, save, export, import, and validate hex arenas.
- Automated coverage is meaningful at the unit/integration level: **289 tests across 18 files pass**.
- `tsc --noEmit` and the Vite production build pass.

These are strong foundations. They should be preserved behind better boundaries rather than rewritten blindly.

### 2.2 Evidence that the game is not release-ready

| Area | Current evidence | Release implication |
| --- | --- | --- |
| Product identity | The repository uses “Dropfall,” “Cyber Arena,” “Star Circuit,” “Neon Edition,” and “SDF Edition” as overlapping product identities. | Pick one product name and use arena/theme names only for content. |
| Client structure | `src/main.js` is about 2,800 lines and `src/style.css` about 4,500 lines. | Flow, match, UI, and presentation changes will keep creating regressions until responsibilities are extracted. |
| Duplicate sources | Parallel `.js` and `.ts` versions of the store and multiple entity systems differ. `checkJs` is disabled. | The passing TypeScript gate does not type-check most of the shipping game. |
| Art assets | There are almost no authored image, model, texture, or audio assets. Hats and pickups are procedural primitives; UI icons are emoji. | A production asset pipeline is mandatory. CSS polish cannot create premium cosmetic quality. |
| Hat consistency | Offline setup renders Three.js hats. Online setup shows a CSS sphere with a floating emoji/name label. The “Astro Helmet” reads as a small cap in the live preview. | Use one asset definition and one preview renderer everywhere. |
| Power-up consistency | All arena pickups share the same octahedral crystal/ring model and rely on color. Settings, notifications, and HUD use OS emoji. | Each effect needs a unique silhouette, icon, VFX, audio signature, timer, and color-blind cue. |
| Mode consistency | Offline has 3D dual-player previews, arena selection, stage skins, and a dense hat grid. Online uses a separate connection/lobby/setup implementation, a select control for hats, and no equivalent arena/editor flow. | Build one shared `MatchSetup` experience with mode-specific adapters. |
| Mobile setup | At 390×844, the setup screen is fixed to viewport height with hidden overflow; dense player panels and controls clip. | Redesign for touch and small screens rather than scaling the desktop layout. |
| Runtime | Local Vite testing repeatedly logs failed level API loads and deprecation warnings from Three.js/Rapier. | Boot and content loading require explicit fallback, error, compatibility, and telemetry paths. |
| Web bundle | Production build emits ~2.24 MB physics, ~0.57 MB Three.js, ~0.52 MB app JS, and ~129 KB CSS before compression. | Lazy-load gameplay, editor, replay, and native/platform integrations; define bundle budgets. |
| Browser coverage | The only configured E2E test checks one solo match movement/pause flow and takes about 68 seconds. | Add multi-mode, two-client, mobile, editor, account, purchase, and visual coverage. |
| Code quality | ESLint reports **4,964 errors and 238 warnings**. | Replace the current unusable lint baseline with staged, enforceable gates. |
| Security | `npm audit --omit=dev` reports a direct high-severity `ws` issue. The server has no authentication, origin allowlist, message schema gate, or rate limit. | Public deployment is blocked until the dependency and trust boundaries are fixed. |
| Admin/editor security | Any socket can claim `isAdmin`; level create/update/delete APIs are unauthenticated and writable with `Access-Control-Allow-Origin: *`. | Never expose the current admin/editor mutation APIs publicly. |
| Durability | Rooms, players, stats, and scores are in memory; levels are local JSON files. There is no database. | Accounts, profiles, purchases, rankings, and UGC require durable storage. |
| Packaging | README/desktop docs claim Electron support, but the package has no Electron scripts or dependencies. There is no Capacitor, PWA, IAP, ad, Game Center, Play Games, or Steam integration. | Platform builds are new production work, not a final packaging step. |
| Repository hygiene | Generated coverage, compiled server assets, an old `dropfall-updated` copy, SDF experiments, and contradictory completion documents are tracked. | Establish one source tree and an archive policy before production. |

### 2.3 Readiness scorecard

Scores describe commercial launch readiness, not effort already invested.

| Discipline | Score | Reason |
| --- | ---: | --- |
| Core concept | 8/10 | Distinct, readable, and suitable for short repeat sessions. |
| Core gameplay implementation | 6/10 | Playable and tested, but mode-specific behavior still drifts. |
| Game feel | 5/10 | Strong visual intent; readability, timing, feedback hierarchy, and audio need production tuning. |
| UI/UX | 5/10 desktop, 2/10 mobile | Main menu is promising; setup/settings/online/editor are fragmented and overly dense. |
| Art/content | 3/10 | Primarily generated geometry and procedural presentation with no production asset pipeline. |
| Online | 4/10 | Authoritative simulation exists; identity, abuse prevention, parity, load, and operations do not. |
| Accounts/social | 0/10 | Not implemented. |
| Scoreboards | 1/10 | Match/session scores exist; persistent local/global boards do not. |
| Editor/UGC | 3/10 | Functional developer tool; not a safe, integrated creator product. |
| Mobile | 2/10 | Touch code exists; packaging, responsive flows, native services, device QA, and compliance do not. |
| Steam | 1/10 | Documentation intent only; no working desktop/Steam build pipeline. |
| Web release | 4/10 | Buildable web app; not installable, production-hardened, content-cached, or operationally complete. |
| Security/privacy | 1/10 | Public write APIs and unauthenticated sockets are blockers. |
| QA/release operations | 3/10 | Good unit base; insufficient E2E, visual, device, network, load, crash, and rollback evidence. |

---

## 3. Product identity and positioning

### 3.1 Canonical identity

- **Product name:** `Dropfall`
- **Descriptor:** `A lightning-fast physics arena duel`
- **Launch visual theme:** `Broadcast neon sport`
- **Star Circuit:** an official arena/theme family, not the product subtitle
- **Cyber Arena / Neon Edition / SDF Edition:** remove from player-facing launch branding

### 3.2 Positioning

Dropfall should sit between low-price, highly replayable physics party games and more content-heavy premium party titles. Current Steam references show **Stick Fight: The Game** at a normal US price of $4.99, **ROUNDS** at $5.99, and **Party Animals** at $19.99. Dropfall can justify a higher price than the first two only when its art, online reliability, editor, official content, progression, and platform features are visibly complete.

Recommended Steam launch corridor: **US$7.99–9.99**, tested before final commitment. Use a modest launch discount, not permanent deep discounting. Mobile/web ad-free pricing should be a lower one-time upgrade, provisionally **US$3.99–4.99** by regional tier.

### 3.3 Audience

- Primary: 13+, friends/couples/siblings who enjoy short competitive sessions.
- Secondary: solo challenge players and creators.
- Session target: 3–8 minutes per match, <30 seconds from menu to offline play, <60 seconds from queue to public online play when population permits.
- Emotional goal: “One more round” without humiliation, unfair monetization, or lengthy setup.

### 3.4 Product pillars

1. **Readable chaos** — hazards are dramatic, but player position, intent, safe ground, and outcome are always legible.
2. **Momentum mastery** — movement is instantly understandable and rewards timing, positioning, recovery, and boost control.
3. **Instant rivalry** — setup, rematch, local handoff, and online queueing preserve energy.
4. **Expressive identity** — players recognize their ball and cosmetic instantly in every screen and mode.
5. **Competitive trust** — authoritative outcomes, visible network state, fair rules, and explainable ranking.
6. **Creator longevity** — making, testing, sharing, and discovering arenas is as polished as playing them.

---

## 4. Launch scope and deliberate cuts

### 4.1 Must ship

- First-run calibration and two-minute playable tutorial.
- Solo duel against Easy, Normal, and Hard AI.
- Two-player couch duel.
- Private online rooms and public casual matchmaking.
- Optional rated queue with seasonal online leaderboard after anti-cheat/load gates pass.
- One canonical best-of format plus two simple casual presets.
- Eight production power-ups.
- Twenty production hats, 40+ coherent ball materials/colors, and saved loadouts.
- Eight to twelve official arenas in three gameplay archetypes.
- Integrated editor with local drafts, validation, test play, cloud save, and moderated publishing.
- Guest play, account signup/linking, profile, entitlements, cloud sync.
- Local device scoreboards and authoritative online scoreboards.
- Replays sufficient for round review and score validation.
- Keyboard, controller, touch, reduced motion, remapping, safe areas, and haptics toggles.
- Steam premium build; iOS/Android free build with ad-free purchase; installable web build.

### 4.2 Hide or defer

- VR/AR settings and runtime.
- SDF experimental renderer.
- Race mode until it has its own rules, HUD, levels, leaderboard, and test matrix.
- User-provided scripts, shaders, images, audio, or arbitrary URLs in custom levels.
- Four-player and team modes.
- Voice or unrestricted text chat. Launch with curated quick-chat/pings only.
- Loot boxes, power sales, consumable competitive boosts, and paid randomized rewards.
- Spectating, tournaments, clans, battle passes, and creator monetization.
- Public ranked play if authoritative telemetry, abuse controls, and population thresholds are not ready.

These cuts are part of the quality strategy. Experimental features may remain in development builds behind compile-time flags, never as unexplained launch settings.

---

## 5. One game flow across every mode

### 5.1 Canonical screen map

```text
Boot
  → Accessibility / performance quick setup (first run)
  → Home
      → Play
          → Solo
          → Local
          → Online
              → Quick Play
              → Ranked
              → Private Room
      → Create
      → Profile & Scoreboards
      → Locker
      → Settings

All modes:
Mode choice → Match Setup → Countdown → Match → Round Result
            → Next Round → Match Result → Rematch / Change Rules / Exit
```

### 5.2 Shared `MatchSetup`

Build one component and one state machine. Mode adapters change only ownership and availability:

| Element | Solo | Local | Online |
| --- | --- | --- | --- |
| Player one card | Local profile | Local profile | Signed-in/guest profile |
| Player two card | AI profile + difficulty | Second local profile | Remote profile |
| Ball/cosmetic preview | Same renderer | Same renderer | Same renderer or exact rendered thumbnail on low-power devices |
| Arena picker | Official + local drafts | Official + local drafts | Official + allowed published versions |
| Rules | Casual presets / custom | Casual presets / custom | Server-owned preset / picker-owned custom |
| Ready state | One confirmation | Both local confirmations | Both network confirmations |
| Network status | Hidden | Hidden | Inline connection/region/latency status |

No mode should use a separate cosmetic catalog, hat control, preview technology, level definition, or rules vocabulary.

### 5.3 Simplify setup

The current setup exposes dozens of colors, 20 hats, two live previews, difficulty, arena, stage skins, and eleven physics sliders at once. Replace this with:

- A primary step showing player identity, current loadout, arena, and preset.
- A `Locker` drawer for deep cosmetic choice.
- A `Custom Rules` drawer for advanced physics and power-up tuning.
- A persistent summary that always shows what will launch.
- One primary `Ready` action.
- Small-screen flow as sequential full-width steps, not a scaled two-column desktop panel.

### 5.4 Rules integrity

- Public casual and ranked queues use versioned, server-owned playlists.
- Private/local custom settings are allowed but marked `Custom` and do not affect ranked boards.
- Every match snapshots `rulesetVersion`, `levelVersion`, `contentManifestVersion`, and RNG seed.
- The server refuses clients with incompatible protocol or content manifests.
- Rules may not change after any player is ready without clearing all ready states.

---

## 6. Core game and feel refresh

### 6.1 Movement contract

- Camera-relative directional input.
- Fixed-step simulation at 60 Hz on server and capable clients.
- Visible boost resource with clear start threshold, drain, recovery, and threat state.
- No gameplay behavior tied to render frame rate.
- Input buffering around countdown end and rematch transitions.
- Clear recovery rules when a player is airborne or near an edge.

### 6.2 Feedback hierarchy

From highest to lowest:

1. Player positions, opponent intent, arena edge, and safe/unsafe tiles.
2. High-impact collision, boost threat, pickup identity, and elimination.
3. Score, timer, round status, connection quality, and active effect duration.
4. Theme ambience and decorative effects.

No bloom, screen shake, particle, hat animation, nameplate, or ad may obscure a higher-priority signal.

### 6.3 Impact and elimination

- Pre-impact: boost trail, audio rise, and a restrained directional tell.
- Impact: contact flash at the collision point, energy-scaled sound, controller haptic, bounded camera impulse, and directional particles.
- Post-impact: short hit-stop presentation only if it does not alter authoritative simulation.
- Elimination: preserve the fall for 0.8–1.2 seconds, clearly mark the winner, then transition.
- Draws: explicit shared outcome; never silently award a late frame.

### 6.4 Camera

- Arena-aware framing with safe margins for HUD and mobile notches.
- Predictive widening when players separate or accelerate.
- Never clip through the arena or winner.
- Reduced-motion mode removes impulse and rapid zoom.
- Replay cameras must never be used to resolve gameplay state.

### 6.5 AI

- Easy: readable mistakes, slower reactions, teaches mechanics.
- Normal: uses boost, avoids obvious hazards, contests pickups.
- Hard: plans safe routes and impact angles but has bounded reaction time and no hidden information.
- AI must run against the same input and simulation contract as a player.
- Add deterministic bot-match tests and five-minute soak matches for every official arena.

---

## 7. Art direction and production asset pipeline

### 7.1 Visual language

Keep the best part of the current menu: precise neon broadcast sport. Apply it consistently:

- Dark, low-noise backgrounds.
- Controlled cyan/magenta/yellow accents.
- High-contrast player colors that remain identifiable in all five themes.
- One display type family and one highly readable UI/body family.
- Crisp geometric panels with restrained glow.
- Premium PBR cosmetics against simpler competitive arenas.
- No operating-system emoji in shipping UI.
- `Star Circuit`, `Beach`, `Temple`, `Arctic`, and `Inferno` change ambience and materials without changing hazard semantics.

### 7.2 Asset pipeline

```text
Blender source
  → naming/socket/scale validator
  → glTF/GLB export
  → meshopt/Draco + KTX2/Basis compression
  → desktop and mobile LODs
  → automated turntable/icon render
  → asset manifest with content hash
  → CDN/store package
```

Repository rules:

- Source art lives outside the runtime bundle or in an LFS/art repository.
- Runtime assets are content-addressed and licensed.
- Every asset has author, license, source file, version, budgets, and supported quality tiers.
- CI rejects missing textures, wrong scale, duplicate materials, absent LODs, invalid sockets, or unbounded animation clips.

### 7.3 Hats

Replace all procedural hat meshes in `hatFactory.ts` with authored GLB assets. Keep the current 20 names only if each passes silhouette and style review; quality is more important than catalog size.

Each hat requires:

- A distinctive front, side, and top silhouette.
- A shared `HeadSocket` origin, orientation, and scale envelope.
- No effect on collider, mass, camera, hitbox, or visibility of hazards.
- Desktop LOD0 target: roughly 5k–12k triangles.
- Mobile LOD1 target: roughly 2k–5k triangles.
- One compact PBR material set where practical; emissive accents remain restrained.
- A physics-safe secondary animation budget or a authored loop.
- A 256×256 transparent icon rendered from the exact model.
- A fallback low-detail mesh and placeholder icon if loading fails.
- Clipping review at minimum/default/maximum ball sizes.
- Review under every official theme and common player color.

The same `CosmeticAsset` record must drive:

- Locker tile.
- Offline setup preview.
- Online setup preview.
- Lobby/player card.
- In-match attachment.
- Result screen.
- Profile and leaderboard avatar treatment.

No screen may substitute an emoji or text label for the actual cosmetic.

### 7.4 Power-ups

Create a data-driven `PowerUpDefinition` shared by simulation, server, UI, assets, audio, telemetry, and editor:

```ts
type PowerUpDefinition = {
  id: string;
  rulesVersion: number;
  nameKey: string;
  descriptionKey: string;
  pickupModel: AssetId;
  icon: AssetId;
  primaryColor: string;
  colorBlindPattern: PatternId;
  pickupSfx: AudioId;
  activeLoop?: AudioId;
  expirySfx: AudioId;
  durationKind: "instant" | "timed";
  competitiveTags: string[];
};
```

Launch identity:

| Existing effect | Production visual concept | Required active tell |
| --- | --- | --- |
| Speed Demon | Split lightning capacitor with forward fins | Orange speed lines + acceleration ring |
| Shrink | Inward-folding blue prism | Contracting chevrons + scaled shadow |
| Heavy Metal | Dense violet gravity core | Weighted ground pulse + low audio layer |
| Rocket Boost | Red directional thruster module | Instant directional burst trail |
| Floaty | Suspended mint feather inside an anti-gravity cage | Upward motes + soft lift loop |
| Mega | Expanding yellow reactor ring | Expanding outline + size-safe nameplate |
| Traction | Cyan tread/magnetic clamp | Grounded tread decal + turn sparks |
| Fortress | Magenta hex shield generator | Segmented shield shell + impact deflection |

Every power-up needs:

- A unique silhouette visible without color.
- A matching vector/raster UI icon produced by the art team, never emoji.
- Pickup anticipation, collect burst, active loop/tell, five-second/two-second expiry cues as applicable, and cleanup.
- A timer ring or instant tag in the HUD.
- One-line name plus concise effect copy in the guide.
- Exact shared behavior offline and online.
- Balance telemetry for pick rate, win delta, elimination contribution, and wasted pickup rate.

Advanced spawn weights belong to `Custom Match`, not general settings. Public playlists use fixed versioned weights.

### 7.5 Arena and environment pass

- Curate eight to twelve launch arenas; do not expose every valid JSON file.
- Three archetypes: open impact, segmented survival, and controlled hazard.
- Each official arena has a tactical description, difficulty, supported modes, checksum, thumbnail, and authored spawn pair.
- Tile state language remains identical across themes: normal, ice, bonus, warning, falling.
- Warning must use color + shape/pattern + animation + sound.
- Remove or isolate experimental/race-only/editor-only level types from release manifests.

### 7.6 Audio

Current procedural audio is a useful prototype, not a final soundtrack.

Ship:

- One adaptive menu theme and five arena ambience/music layers.
- A coherent UI sound set.
- Material-aware roll and collision layers.
- Eight power-up audio signatures.
- Boost start/loop/stop, low-energy, and recovered cues.
- Announcer stingers or concise nonverbal result cues.
- Separate Master, Music, SFX, UI, Voice/Announcer, and Ambience buses.
- Loudness normalization, limiter, concurrency limits, and mobile speaker review.
- Full recovery after browser/mobile audio suspension.

---

## 8. Integrated level editor and UGC

### 8.1 Product placement

`Home → Create` opens the editor inside the game shell. It must use the same typography, navigation, profile, audio, input hints, materials, asset manifest, level schema, and error system as the rest of Dropfall.

### 8.2 Creator flow

```text
Choose template
  → Edit
  → Live validation
  → Test play
  → Save local/cloud draft
  → Add metadata and thumbnail
  → Publish
  → Automated checks
  → Moderation state
  → Discoverable version
```

### 8.3 Editing tools

- Normal, ice, bonus, and spawn brushes.
- Place/remove, height, paint, fill, line, ring, mirror, rotate, and selection tools.
- Undo/redo with at least 100 actions.
- Keyboard/mouse, controller cursor, and touch gestures.
- Top/angled camera presets and focus-selected.
- Arena bounds, connectivity, spawn safety, supported ability, tile count, and performance budgets shown live.
- Auto-fix options for duplicate tiles, missing spawns, and unsupported metadata where safe.
- Test play directly from the current unsaved draft.

### 8.4 Data and security

- Versioned declarative level schema; no arbitrary code, script, shader, texture URL, HTML, or audio URL.
- Immutable published versions with `levelId`, `versionId`, `contentHash`, owner, timestamps, moderation status, and rules compatibility.
- Online matches reference an approved immutable version, never a mutable draft.
- Client uploads to an authenticated API; the server validates independently.
- Store levels in durable database/object storage, not the application filesystem.
- Rate-limit create/update/publish/report endpoints.
- Record ownership and a moderation audit trail.

### 8.5 Publishing and moderation

- Guests may create, save locally, export, and test.
- A verified Dropfall account is required to publish.
- Display-name and metadata profanity filtering.
- Report level, report creator, block creator, hide from me.
- Automated checks for invalid data, misleading names, spam duplication, excessive geometry, and prohibited metadata.
- Human moderation queue, appeal path, support contact, takedown, and creator sanctions.
- Deleting an account removes or anonymizes associated UGC according to the published policy.

Apple requires UGC apps to provide filtering, reporting, blocking, and published contact information; Google requires ongoing moderation and terms acceptance before upload. The creator workflow is therefore inseparable from the account, moderation, and privacy work.

### 8.6 Discovery

- Featured, New, Trending, Friends, My Levels, Favorites, and official collections.
- Filter by archetype, difficulty, size, and supported playlist.
- Show creator, version, plays, likes, completion/abandon rate, last update, and validation badge.
- Do not rank purely by raw plays; include quality, freshness, reports, and completion.
- Canonical cross-platform catalog first. Steam Workshop mirroring is post-launch to avoid splitting IDs and moderation.

---

## 9. Accounts and player profiles

### 9.1 Account policy

- Offline solo/local play and local editing work without signup.
- Public matchmaking, ranked scores, cloud sync, and publishing require an account.
- Private rooms may allow an ephemeral guest with no ranking or publishing privileges.
- First-run never blocks on account creation.
- A local guest profile can be upgraded and merged without losing cosmetics, records, settings, or drafts.

This follows Apple’s expectation that apps without a necessary account dependency remain usable without login.

### 9.2 Sign-in methods

- Web: email magic link, passkey where supported, and linked platform identities.
- iOS: Sign in with Apple plus email magic link.
- Android: Google Play Games/Google identity plus email magic link.
- Steam: Steam session ticket verified by the Dropfall backend.
- Never store a custom password database for v1.
- Allow multiple provider identities to link to one Dropfall account after reauthentication.
- Detect and resolve merge conflicts explicitly.

### 9.3 Profile

Public:

- Moderated unique display name.
- Selected ball material, hat, profile banner/badge.
- Season rank and broad skill tier.
- Favorite official/user arena.
- Opt-in public match summary and creator stats.

Private:

- Account ID and linked identities.
- Entitlements and verified purchase receipts.
- Settings and input preferences.
- Cloud drafts and local-to-cloud sync state.
- Full match history and moderation/report status.
- Privacy, consent, export, and deletion controls.

### 9.4 Safety and privacy

- Minimize collection: no phone number, precise location, contacts, microphone, or advertising identifier for core play.
- Use generated internal IDs; do not expose email or platform IDs.
- Curated quick chat only at launch.
- Profanity/reserved-word screening, report/block, cooldowns, and sanctions.
- In-app account deletion on iOS and Android.
- A web deletion-request URL for Google Play.
- Revoke provider tokens during deletion and explain retention of fraud/moderation records.
- Publish privacy policy, terms, community standards, support contact, data retention, and subprocessor list.

---

## 10. Local and online scoreboards

### 10.1 Distinguish the boards

| Board | Source | Includes | Trust level |
| --- | --- | --- | --- |
| Session scoreboard | Current match session | Wins/losses, streak, rounds | Local/session |
| Device local board | Local profiles on device | Match wins, fastest win, streak, arena records | Device-only |
| Friends board | Canonical backend + platform graph | Seasonal rating or curated challenge scores | Authoritative |
| Global seasonal board | Canonical backend | Rated matchmaking result | Authoritative |
| Arena challenge board | Canonical backend | Time/survival/score on approved official rules | Authoritative |
| Creator board | Canonical backend | Plays, likes, completion, featured count | Moderated aggregate |

Custom-rule and editor test matches never submit to competitive boards.

### 10.2 Rated play

- Start with a visible skill tier and hidden confidence/uncertainty.
- Provisional placement period.
- Glicko-2 or another uncertainty-aware 1v1 rating, validated with simulation before launch.
- Seasonal soft reset; preserve lifetime peak and previous badges.
- No rating change on server-confirmed invalid/abandoned matches.
- Disconnect policy distinguishes voluntary leave, server failure, and successful reconnect.
- Region and input-family preferences; cross-play clearly indicated.

### 10.3 Authoritative score pipeline

```text
Server completes match
  → append signed MatchResult event
  → validate protocol/rules/content versions
  → update rating transaction
  → update canonical leaderboard projection
  → emit profile/history update
  → mirror eligible score to Steam/Game Center/Play Games
```

- Clients never submit winner, rating, or raw global score as authority.
- Match event includes participants, build, server, ticks, final score, disconnects, level/rules versions, and compact replay/checksum evidence.
- Idempotency key prevents duplicate results.
- Suspicious results go to review and may be withheld.
- Leaderboards support pagination, around-me, friends, region where lawful, and season/archive views.

### 10.4 Platform mirrors

- Steam: use **Trusted** writes through the Web API so clients cannot forge scores.
- iOS: mirror appropriate challenge/season scores to Game Center.
- Android: mirror appropriate scores to Google Play Games Services.
- Dropfall’s backend remains canonical for cross-platform identity, ratings, moderation, and history.

---

## 11. Monetization: ad-supported and paid ad-free

### 11.1 Recommended SKU strategy

Do not maintain separate free and paid mobile binaries. They split reviews, installs, saves, QA, matchmaking, and store metadata.

| Platform | Entry product | Ad-free product |
| --- | --- | --- |
| Steam | Premium paid game | Included; no ad SDK in the build |
| iOS | Free download with ads | Permanent `Remove Ads` non-consumable IAP |
| Android | Free download with ads | Permanent `Remove Ads` one-time product |
| Web | Free ad-supported game | Permanent account entitlement bought through the web storefront |

The user-visible result is still an ad-powered version and a paid ad-free version, but one codebase and entitlement model are maintained.

### 11.2 Ad placement rules

Allowed:

- One restrained menu/lobby placement where layout remains stable.
- Interstitial only after a completed match, never after the first two completed matches.
- Remote-configurable initial cap: at most one interstitial per ten minutes and four per session.
- Optional rewarded ad after launch only for a temporary cosmetic trial or noncompetitive cosmetic progression.

Forbidden:

- Any ad during countdown, gameplay, replay, matchmaking confirmation, ready state, or reconnect.
- Ads that delay rematch while the opponent waits.
- Rewarded gameplay strength, extra boost, stronger power-ups, rating protection, or editor capability.
- Surprise full-screen ads, fake system UI, accidental-click layouts, or ads outside the app.
- Initializing ad/identification SDKs in the premium Steam build.

### 11.3 Ad-free entitlement

- Removes all third-party ads permanently for the entitled Dropfall account/platform receipt.
- Does not remove first-party patch notes or optional Dropfall news.
- Restore Purchases is visible in profile/settings.
- Server verifies Apple/Google receipts and records immutable entitlement events.
- Offline grace cache allows the entitlement to work without a network.
- Linking can honor verified entitlements across platforms where store rules permit, but mobile purchase screens must use the applicable store billing path and must not steer users to an external payment flow.

### 11.4 Consent

- Contextual/nonpersonalized ads are the default product assumption.
- Request Apple ATT only if the final SDK configuration actually tracks across apps/sites.
- Use a Google-certified consent management platform for EEA/UK ad consent.
- No ad request before required consent state is resolved.
- Consent is revocable in Privacy Settings.
- App Store privacy details and Play Data Safety must cover every embedded SDK.

### 11.5 Economy

Launch with earned cosmetics and the ad-free purchase only. If paid cosmetics are added later:

- Direct purchase, no randomized paid drops.
- Cosmetic only.
- Clear preview and ownership.
- Platform billing for digital items.
- A stable catalog and refund/revocation handling.

---

## 12. Technical architecture

### 12.1 Target workspace

```text
apps/
  web/                 Vite/PWA shell
  desktop/             Electron/Steam shell
  mobile/              Capacitor iOS/Android projects
  server/              HTTP, WebSocket, matchmaking, simulation
packages/
  game-core/           rules, state machines, deterministic utilities
  simulation/          Rapier adapters, players, arena, power-ups
  protocol/            versioned Zod schemas and generated types
  game-client/         rendering, camera, VFX, audio, replay
  ui/                  shared accessible screen/components/design tokens
  editor/              editor state, tools, validation, test play
  content/             level/cosmetic/power-up manifests
  platform/            auth, purchases, ads, storage, achievements adapters
  telemetry/           events, faults, performance
```

This can be introduced incrementally with npm workspaces. Do not stop feature work for a “big bang” rewrite.

### 12.2 Migration rules

- Choose TypeScript as the source of truth.
- Delete `.js`/`.ts` twins only after behavior and tests are reconciled.
- Keep `main.js` as composition root temporarily; no new domain logic goes into it.
- Extract flow state machine first, then match controller, then presentation systems.
- Split CSS by tokens, primitives, components, screens, and themes; remove stacked legacy overrides.
- Archive obsolete SDF/VR/duplicate projects outside the shipping graph.
- Generated `dist`, server bundle, and coverage output must not be hand-maintained source.

### 12.3 Simulation and networking

- Server-authoritative 60 Hz physics.
- 20–30 Hz snapshots, measured rather than assumed.
- Sequenced normalized input with rate and value clamps.
- Client prediction/reconciliation for local player; buffered interpolation for remote player.
- Seeded gameplay randomness.
- Version every message and validate every inbound payload.
- Include match ID, server tick, input sequence/ack, rules checksum, and content checksum.
- Signed reconnect token bound to account/session/match/slot; no “first disconnected slot” rejoin.
- TLS/WSS only in production.
- Per-IP/account connection, message, room, publish, and report limits.
- Region selection and autoscaling before ranked release.

### 12.4 Durable services

Recommended production foundation:

- Managed PostgreSQL for accounts, identities, profiles, entitlements, match events, ratings, levels, reports, and moderation.
- Redis-compatible service for presence, matchmaking queues, rate limiting, and short-lived resume state.
- Object storage/CDN for level versions, thumbnails, replay evidence, and content manifests.
- Managed email/auth provider for magic links, with custom platform-token verification.
- Structured logs, traces, metrics, error monitoring, alerting, dashboards, and backups.

Core tables:

```text
users
identities
profiles
entitlements
purchase_receipts
matches
match_participants
rating_events
leaderboard_entries
levels
level_versions
level_reports
moderation_actions
audit_events
```

Use append-only entitlement, match-result, and rating events; derive current projections transactionally.

### 12.5 API boundaries

- `/v1/auth/*`
- `/v1/profile/*`
- `/v1/entitlements/*`
- `/v1/leaderboards/*`
- `/v1/levels/*`
- `/v1/moderation/*`
- `/v1/matchmaking/*`
- `/health/live` and `/health/ready`

Admin tools use separate authenticated roles and routes. Never infer admin authority from a client boolean.

### 12.6 Platform abstraction

```ts
interface PlatformServices {
  identity: IdentityProvider;
  purchases: PurchaseProvider;
  ads: AdProvider;
  achievements: AchievementProvider;
  leaderboardMirror: LeaderboardMirror;
  cloud: CloudSaveProvider;
  haptics: HapticsProvider;
  lifecycle: LifecycleProvider;
}
```

Web, Steam, iOS, and Android provide implementations. Core gameplay never imports Steam, Apple, Google, Electron, Capacitor, or an ad SDK directly.

---

## 13. Platform release plan

### 13.1 Steam

- Build a hardened Electron shell only after a prototype proves:
  - Fullscreen/window switching.
  - Controller ownership and hot-plug.
  - Steam overlay on supported targets.
  - Steam session-ticket authentication.
  - Trusted leaderboard write through backend.
  - Achievements, cloud save, invites/joins, and graceful offline mode.
  - Crash reporting and update-safe saves.
- Follow Electron security guidance: current Electron, local packaged content, no Node integration in the renderer, context isolation, sandboxing, restrictive CSP, narrow validated IPC, navigation/window allowlists.
- Target Windows first and treat Steam Deck as a formal compatibility target. Add macOS only when Steamworks native module, signing, notarization, and performance are proven.
- Publish the Coming Soon page once art direction and screenshots are final enough to avoid brand drift.
- Budget for Valve’s current $100 Steam Direct app fee, 30-day post-fee wait, at least two weeks of public Coming Soon visibility, store/build review, trailer, capsules, localized copy, and controller assets.
- Premium build has no ad SDK or ad placeholders.

### 13.2 iOS/iPadOS

- Use Capacitor v8 or the then-current supported release to wrap the web-first client and bridge native services.
- Landscape-first iPhone/iPad UI with safe areas, thermal/memory handling, background/resume, audio interruption, controller, touch, and haptics.
- Add Game Center, StoreKit, Sign in with Apple, ATT if required, consent, and native support/privacy surfaces.
- Provide meaningful native/game functionality and offline play; do not submit a thin website wrapper.
- Account creation requires in-app deletion.
- Digital ad-free upgrade uses Apple In-App Purchase.
- UGC requires report/block/filter/contact and moderation.
- App privacy details include Dropfall and all third-party SDK behavior.
- Test through internal and external TestFlight cohorts on minimum, median, and current devices.
- Re-check Apple’s current SDK/Xcode upload requirements immediately before submission.

### 13.3 Android

- Use the same Capacitor client with native bridges for Play Billing, Google Play Games Services, ads/consent, lifecycle, controller, haptics, and deep links.
- Ship Android App Bundle with Play App Signing.
- From 31 August 2026, new apps/updates must target Android 16 / API 36 or higher; keep this as an automated release check, not a hard-coded forever assumption.
- Ad-free upgrade uses Google Play Billing except where a formally enrolled regional alternative program applies.
- Complete Data Safety for first- and third-party SDK collection.
- Provide both in-app account deletion and a web deletion-request URL.
- Meet UGC terms/moderation and target-audience/ads declarations.
- Test low-memory process death, thermal throttling, back navigation, aspect ratios, foldables/tablets, controller, and interrupted purchases.

### 13.4 Web

- Add web app manifest, icons, install metadata, service worker, versioned asset cache, offline solo/local shell, and update prompt.
- Never cache API/auth responses as immutable game assets.
- Lazy-load Rapier, renderer, replay, editor, and high-resolution cosmetics.
- Support WebGL2 with a branded unsupported-device path; WebGPU may be an enhancement, never the only launch renderer.
- Use HTTPS/WSS, CSP, HSTS, correct immutable caching for hashed assets, and short caching for manifests.
- Responsive keyboard/controller/touch UI from 320 CSS px through ultrawide.
- Provide consent, privacy, terms, support, account deletion, and purchase restoration on the web.

---

## 14. Accessibility and input

- WCAG 2.2 AA contrast for essential UI.
- Functionality at 200% browser zoom and 320 CSS px.
- Minimum 44×44 CSS px touch targets.
- Safe-area support for notches and home indicators.
- Full keyboard navigation with visible focus.
- Controller navigation and prompts based on active device.
- Remappable movement/boost/menu controls with conflict detection.
- Gamepad dead zone, vibration strength/off, touch sensitivity, and handedness options.
- Reduced motion removes camera shake, pulsing menu motion, rapid zoom, and nonessential particles.
- Color-blind safe player/hazard/power-up patterns.
- Countdown, warnings, pickups, and elimination use visual and audio cues.
- Subtitle/caption support for any voiced competitive information.
- Pause freezes offline simulation only; online focus loss never grants gameplay advantage.
- Clear held inputs on blur, visibility change, touch cancellation, controller disconnect, and pause.

---

## 15. Performance and reliability budgets

### 15.1 Client

| Metric | Desktop target | Mobile target |
| --- | ---: | ---: |
| Menu interactive, warm | ≤1.5 s | ≤2.0 s |
| Menu interactive, cold typical network | ≤3.0 s | ≤4.0 s |
| Match start after content ready | ≤3.5 s | ≤4.5 s |
| Gameplay | 60 fps | 60 fps target, 30 fps minimum tier |
| 1% low | ≥50 fps | ≥24 fps |
| Local input-to-visible response p95 | ≤50 ms | ≤70 ms |
| Crash-free sessions | ≥99.8% | ≥99.7% |
| Five-match memory growth | <5% after GC/cleanup | <5% after GC/cleanup |

Additional budgets:

- Initial shell JS ≤250 KB gzip; gameplay systems loaded after mode intent.
- Initial CSS ≤60 KB gzip.
- Dynamic resolution and capped device pixel ratio.
- No per-frame DOM reconstruction for HUD/lobby.
- Pool collision VFX and power-up effects.
- LOD and compressed textures/models.
- Renderer/context-loss recovery.
- No unbounded catch-up after tab/app resume.

### 15.2 Online

- 60 Hz authoritative simulation.
- Median target RTT ≤80 ms in supported regions; clearly warn above 150 ms.
- Match completion ≥98% excluding deliberate quits.
- Reconnect success ≥90% when the client returns within grace and the service is healthy.
- Idempotent match result and purchase processing.
- No unbounded room/session/timer retention.
- Soak: 24 hours without rising room/player/timer baseline.
- Load: prove target concurrent matches with 30% headroom before public ranked launch.

---

## 16. Security, privacy, and abuse blockers

Before any public beta:

- Upgrade `ws` to a nonvulnerable release and make dependency audit a CI gate.
- Replace `Access-Control-Allow-Origin: *` on mutation/auth APIs with environment allowlists.
- Authenticate every level mutation, report, profile, score, and entitlement request.
- Remove client-controlled `isAdmin`.
- Validate every WebSocket message with bounded Zod schemas.
- Set WebSocket maximum payload, connection/message rates, heartbeat, queue bounds, and idle timeouts.
- Reject unknown message types and incompatible protocol versions.
- Signed short-lived access tokens and rotation/refresh rules.
- Signed reconnect token; never rejoin an arbitrary disconnected slot.
- Separate public client, game server, moderation, and admin privileges.
- CSP, HSTS, frame, MIME, referrer, and permissions policies.
- Sanitize names/metadata and render user text with safe text APIs.
- Encrypt in transit; encrypt sensitive durable data at rest.
- Secrets in managed secret storage, not client environment or repository.
- Audit logs for admin/moderation/purchase actions.
- Backups, restore rehearsal, retention, deletion, incident response, and breach process.
- Threat model accounts, entitlements, leaderboard fraud, UGC, reconnect, room abuse, and editor payloads before implementation freeze.

---

## 17. Telemetry and live operations

### 17.1 Product events

- Boot/start success and failure reason.
- Tutorial start/complete/drop.
- Mode/setup/queue funnel.
- Queue time, region, RTT bucket, disconnect/reconnect.
- Match/round duration, outcome, rules, official level version.
- Power-up spawn/pick/use/expiry and outcome delta.
- Rematch and exit reason.
- Editor create/validate/test/save/publish funnel.
- Ad opportunity/request/show/close/error.
- Purchase start/success/failure/restore.

Do not log free-form profile text, email, tokens, raw IP, or full replays to general analytics.

### 17.2 Operational dashboards

- Crash-free sessions and top exceptions by build/platform.
- Match completion, reconnect, queue time, tick delay, snapshot size.
- Server CPU/memory/room counts and event-loop delay.
- Content download failures and asset version drift.
- Purchase verification and entitlement mismatch.
- UGC publish/report/moderation SLA.
- Ad fill/eCPM only after consent, separated from gameplay balance decisions.

### 17.3 Release controls

- Feature flags and remote config with safe defaults.
- Staged web deployment and store phased rollout.
- Client/server protocol compatibility window.
- Content manifest rollback.
- Database migration rollback/forward-fix plan.
- Kill switches for ranked, UGC publishing, ads, and individual power-ups without disabling offline play.

---

## 18. QA strategy and release gates

### 18.1 Automated

- Unit: rules, power-ups, ratings, economy, auth merge, entitlements, editor commands, validation.
- Contract: every client/server/API schema and migration.
- Simulation golden tests: seeded matches and authoritative outcome invariants.
- Integration: durable match result → rating → leaderboard; receipt → entitlement; level publish → moderation.
- Browser: all screens and all three modes at desktop/tablet/mobile.
- Network: two clients for create/join/ready/start/round/rematch/reconnect/host loss/version mismatch.
- Platform adapter fakes for purchase, ads, auth, achievements, and lifecycle.
- Visual regression: five themes, hats, power-ups, HUD, editor, ads, reduced motion, high zoom.
- Performance: bundle budgets, five-minute bot match, effect storms, large valid arena.
- Load/soak/fault injection on public services.

### 18.2 Manual/device matrix

- Windows 10/11 and Steam Deck class hardware.
- Supported iPhone/iPad minimum, median, and current high-end.
- Android minimum, median, high-end, tablet/foldable.
- Chrome, Edge, Safari, and Firefox current supported versions.
- Keyboard layouts, Xbox/PlayStation/Switch-style controllers, hot plug, two local controllers.
- Touch, notches, safe areas, rotation handling, notifications, calls/audio interruption, low battery, thermal throttling.
- Offline boot, flaky network, captive portal, server maintenance, clock skew, and storage denial.

### 18.3 Definition of release candidate

All must be true:

- No P0/P1 defects and accepted owners/dates for every P2.
- Production dependency audit has no unaccepted high/critical issue.
- Lint, type, test, build, contract, E2E, visual, performance, and packaging gates pass.
- No duplicate shipping JS/TS implementations.
- All 20 hats and 8 power-ups pass asset, clipping, LOD, accessibility, and cross-mode checks.
- Official levels pass automated and human fairness/performance review.
- Account creation/link/merge/export/delete works.
- Local and online scoreboards handle duplicate, fraud, disconnect, and season transitions.
- Ads obey placement/frequency/consent and ad-free builds never initialize the ad SDK.
- Editor works with mouse, controller, and touch; published content is moderated and versioned.
- Two-client adverse network and reconnect matrix passes.
- Load/soak and rollback rehearsals pass.
- Privacy policy, terms, community standards, support, store disclosures, age rating, licenses, and credits are complete.
- Store builds pass TestFlight, Play testing, and Steam review checklists.

---

## 19. Delivery plan

Calendar ranges assume a focused core team of 4–6 with art/audio support. A solo or two-person effort should expect substantially longer.

### Phase 0 — Product lock and production setup (2–3 weeks)

- Confirm name, audience, launch scope, monetization, and target devices.
- Archive experimental/duplicate trees from the shipping graph.
- Establish workspaces, CI, enforceable lint baseline, error monitoring, artifact/version policy.
- Security patch current public server.
- Build vertical-slice art brief and performance capture baseline.

**Exit:** one agreed source tree, no known public-write/admin blocker, measured baseline, signed scope.

### Phase 1 — Shared foundation (4–6 weeks)

- Extract flow/match state machines and shared UI tokens/components.
- Create `PowerUpDefinition`, `CosmeticAsset`, `LevelVersion`, and protocol schemas.
- Unify solo/local/online `MatchSetup`.
- Rebuild mobile setup navigation.
- Add platform service interfaces and content manifest.

**Exit:** the same two placeholder hats and power-ups render and behave across every mode.

### Phase 2 — Release vertical slice (4–6 weeks)

- One final arena/theme.
- Two final hats and two final power-ups.
- Final HUD, impact, result, replay, UI/audio language.
- Working account/profile, local board, authoritative online board.
- Integrated editor create/validate/test/save.
- Desktop and mobile prototype builds on hardware.

**Exit:** executive greenlight based on a complete quality slice, not mockups.

### Phase 3 — Content and systems production (8–12 weeks, parallel)

- Remaining 18 hats, 6 power-ups, 7–11 official arenas.
- Final music/SFX/VFX/theme passes.
- Account linking, cloud sync, entitlements, local/global/friends boards.
- Matchmaking, rating, anti-abuse, reconnect.
- Full editor tools, cloud drafts, publishing, discovery, moderation.

**Exit:** content complete, feature complete, all content in automation.

### Phase 4 — Platformization and monetization (6–8 weeks)

- Steam shell, auth, trusted board mirror, achievements, cloud, store assets.
- Capacitor iOS/Android, native auth, billing, game services, ads/consent, lifecycle.
- PWA/offline/update/caching.
- Privacy, deletion, terms, disclosures, age ratings.

**Exit:** alpha builds on all four targets with purchases/ads/account flows in sandbox.

### Phase 5 — Alpha, closed beta, and hardening (6–8 weeks)

- Real-player balance and UX testing.
- Ad frequency and pricing experiments without compromising gameplay.
- Network fault, load, soak, device, accessibility, and localization.
- Creator moderation drills and incident simulations.
- Performance and download-size optimization.

**Exit:** release candidate gates pass.

### Phase 6 — Store review and staged launch (4–6 weeks)

- Steam Coming Soon/wishlist campaign already active.
- TestFlight/Play pre-registration/testing, Steam review.
- Web soft launch by region/cohort.
- Controlled mobile rollout and premium Steam release.
- Daily launch dashboards, support, rollback readiness.

### Credible duration

- Focused 4–6 person team: roughly **7–10 months** from approved specification to staged public release.
- Two-person team with contractors: roughly **12–18 months**.
- One person: scope must be reduced further; the full plan is not a credible near-term solo release.

---

## 20. Team and ownership

Minimum practical ownership:

- Product/game design lead.
- Client/gameplay/graphics engineer.
- Backend/network/platform engineer.
- UI/UX designer with motion and accessibility responsibility.
- 3D technical artist for hats, pickups, materials, LOD, and pipeline.
- Audio designer/composer as a contract or part-time role.
- QA/release owner with real-device and store responsibility.
- Part-time moderation/community/support before UGC beta.
- Legal/privacy review for accounts, children/age targeting, ads, UGC, purchases, and regional launch.

One person may hold multiple roles, but no responsibility may be unowned.

---

## 21. Prioritized backlog

### P0 — blocks public testing

- Patch vulnerable `ws`.
- Remove unauthenticated admin and level mutation authority.
- Origin/rate/payload/schema/protocol enforcement.
- One source of truth for shipping code and content.
- Fix small-screen setup clipping.
- Reliable production content/level loading.
- Privacy/terms/support skeleton before accounts or analytics.

### P1 — blocks release candidate

- Shared setup flow and design system.
- Production hat/power-up pipeline and all launch assets.
- Account/profile/delete/link/merge.
- Durable match, entitlement, level, rating, and moderation storage.
- Local and authoritative online boards.
- Integrated editor and UGC safeguards.
- Steam/mobile/web build pipelines and platform services.
- Full E2E/visual/device/network/load gates.

### P2 — required polish

- Final audio/music and theme cohesion.
- Tutorial/onboarding and accessibility.
- Creator discovery and profile presentation.
- Achievements, cloud saves, platform leaderboard mirrors.
- Localization and store/trailer/capsule assets.
- Dynamic quality, content streaming, update/rollback UX.

### P3 — post-launch

- Steam Workshop mirror.
- Race mode.
- Spectator/tournament systems.
- Four-player/team modes.
- VR/AR.
- Cosmetic store/battle pass only after retention, safety, and platform operations are healthy.

---

## 22. Research basis and current platform constraints

Primary references used for this specification:

- [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- [Steam onboarding and release waits](https://partner.steamgames.com/doc/gettingstarted/onboarding)
- [Steam Coming Soon requirement](https://partner.steamgames.com/doc/store/coming_soon)
- [Steam trusted leaderboards](https://partner.steamgames.com/doc/features/leaderboards)
- [Steam user authentication and ownership](https://partner.steamgames.com/doc/features/auth)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple in-app account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple App Tracking Transparency](https://developer.apple.com/documentation/apptrackingtransparency)
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple GameKit and Game Center](https://developer.apple.com/documentation/GameKit)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/17105854)
- [Google Play Games leaderboards](https://developer.android.com/games/pgs/android/leaderboards)
- [Google consent/ad serving modes](https://developers.google.com/admob/ios/privacy/ad-serving-modes)
- [Capacitor documentation](https://capacitorjs.com/docs)
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Stick Fight: The Game](https://store.steampowered.com/app/674940/Stick_Fight_The_Game/)
- [ROUNDS](https://store.steampowered.com/app/1557740/ROUNDS/)
- [Party Animals](https://store.steampowered.com/app/1260320/Party_Animals/)

Store and SDK rules change. Re-run the platform compliance audit at vertical-slice approval, content complete, release candidate, and immediately before every submission.

---

## 23. Immediate next actions

1. Approve or amend the launch scope and deliberate cuts.
2. Confirm whether `Star Circuit` remains an arena/theme name and `Dropfall` becomes the only product name.
3. Staff or contract the technical-art and audio pipeline before adding more procedural cosmetics.
4. Execute P0 security fixes before exposing the server/editor beyond trusted local testing.
5. Build the release vertical slice rather than producing all 20 hats first.
6. Create the shared `MatchSetup` and content definition schemas as the first implementation slice.
7. Prototype Electron/Steam and Capacitor on target hardware during Phase 1, not at the end.
8. Start the Steamworks onboarding/Coming Soon asset track early enough for the 30-day and two-week minimum waits.
9. Treat this document as the acceptance baseline; every feature needs an owner, milestone, test, and measurable exit criterion.
