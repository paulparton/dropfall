# Dropfall ads, revenue and analytics

Audit and rollout plan · 10 September 2026

## Current activation note — 10 September 2026

Dropfall Game Studio is the public brand for this general-audience rollout; privacy questions, access requests and deletion requests use `dropfallgamestudio@gmail.com`. Production analytics is enabled for the library and Dropfall Arena only. Deployment `b5418115-93ca-4ab1-9a15-942063073976` succeeded with `VITE_DROPFALL_ANALYTICS_ENABLED=true`, and Google Analytics receipt was verified in the dedicated account/property (2 `page_view`, 1 `library_view`, 1 `game_ready`). The two active users were separate product identifiers in the test browser, not two people. Other games remain disabled; ads remain off, AdSense is **Getting ready**, and H5/CMP work is pending. This status makes no legal-compliance claim.

## AdSense setup follow-up — 10 September 2026

The owner supplied publisher `pub-7669551026428141`. The authenticated dashboard lists `dropfall-game.com` but initially reports **Requires review**, with ads.txt **Not found** and Auto ads off. Non-executing site verification and the dedicated ads.txt record are implemented; see `ADSENSE_SETUP.md` for the observed deployment/review outcome. This resolves the missing publisher-account identifier, not site approval, H5 access, audience/privacy decisions or certified ad consent. No advertising SDK has been activated and the four games are not yet monetized.

## Analytics setup follow-up — 10 September 2026

The owner has now supplied a dedicated Google Analytics account. Account `407483272` (dropfall games), property `553499991` (dropfall-store), stream `15750213019`, tag `G-HSDS6QM123` were verified in the authenticated dashboard. The library and Arena now have an opt-in integration in source, including privacy controls and match events. Production activation succeeded and receipt was verified in Realtime. Ads, payments and the three other game integrations remain disabled. See [the setup runbook](ANALYTICS_SETUP.md) for current status and activation checks.

For this first integration, the supplied website stream covers the library and Arena, using separate browser consent keys/cookie prefixes and an explicit `product_id` event label. This supersedes the five-property recommendation below for those two surfaces; it does not authorize a shared PDS destination or automatically integrate the other games. The original audit below records the state **before** this setup.

## Decision and present status

Dropfall is a separate advertising, revenue and measurement operation from Pelican Drop Studios (PDS). No PDS publisher IDs, analytics destinations, pixels, customer lists, payment links, Stripe credentials, audiences or campaign budgets are to be reused.

**No revenue-generating ad network or gameplay analytics integration was found in the inspected live games.** Super Face Pop has a functioning house-promotion link, which earns no direct ad revenue. Big Racers has more advanced monetization code locally, but that code is not deployed. No account has been created and no SDK, campaign, payment flow or optional tracking has been activated by this audit.

The copy refresh is independently deployable. Monetization is **blocked pending account ownership, consent/privacy implementation and game integrations**. The current rollout is general-audience; a configured ID alone will not finish this work. The readiness registry is an offline checklist, not runtime instrumentation, account verification or a consent system.

## What was checked

Reviewed the library and all four local repositories; inspected public game HTML, runtime assets, public configuration and policy routes. Super Face Pop also received a fresh-browser resource/storage check. moFighter's 43 live HTML/CSS/JS files matched the deployed preview package; Big Racers' 17 referenced live JS chunks were inspected. No private analytics/ad dashboards, private environment values, merchant balances or hosting access logs were inspected. Absence of a shipped tag does not prove that a hosting provider stores no operational data.

| Product | Live ads and measurement | Payments/ad-free | Important gap |
| --- | --- | --- | --- |
| Library — `dropfall-game.com` | No ad slot or analytics collector; favourites are device-local | None | No privacy/consent surface or launch funnel measurement |
| Dropfall Arena — `/dropfall-arena/` and `dropfall.dropfall-game.com` | Policy helper only; no provider or analytics events | Product/entitlement policy exists, but no live checkout | Strict CSP currently disallows vendor tags; local profiles and server scoreboard are not analytics |
| Super Face Pop — `super-face-pop.dropfall-game.com` | Title-screen house link to Dropfall; no paid network, impression/click counting or gameplay analytics | Coffee link code exists but live URL is empty; no ad-free purchase/restore | No CMP; `/privacy` and `/ads.txt` return 404 |
| Big Racers — `big-racers.dropfall-game.com` | No vendor tags identified in deployed chunks | Local Stripe code includes game-specific ad removal, restore and refund handling; not live | Live `/api/monetization`, `/support` and `/ads.txt` return 404; local runbook previously required PDS Stripe |
| moFighter — `mofighter.dropfall-game.com` | No ads, analytics, external runtime URLs or collector | No checkout, identity or entitlement service | No privacy/consent route; static release manifest/server must explicitly include new integration files |

### Evidence and implementation boundaries

- Dropfall: `src/services/monetization.js`, `tests/monetization-policy.test.ts`, `src/main.js` store subscription and `server/security.js`. Current helper permits an offline post-match opportunity every third completed match after consent, excludes children/online/paid players; it is **not wired to ads**. Retain its protections and add the portfolio time/session caps before integration.
- Library: `src/library/main.js`, `src/library/catalog.js`, `index.html`. New-tab launches must continue to work synchronously; analytics may not delay a click or turn it into a popup-blocked async launch. Google Fonts is an existing external resource, not a GA4 integration.
- Super Face Pop: `shared/monetization.js`, `src/monetization.js`, `src/game.js`, `src/menu.js`, `server/security.js`, `server/db.js`. Public configuration controls plain links only. Ad dismissal is not consent. Multiplayer assigns online metadata after a shared start function, so measure after the final mode is known. Do not count an impression every animation frame.
- Big Racers: `app/support-panel.tsx`, `app/page.tsx`, `db/payments.ts`, `lib/player-identity.ts`, `app/support/page.tsx`. Driving “telemetry” is vehicle instrumentation, not business analytics. Preserve server-verified entitlements; do not deploy its old shared-PDS merchant plan. Its privacy copy promises no ad scripts/pixels and must change before those are added.
- moFighter: `src/main.js`, `src/game/match.js`, `src/ui/arcade-menu.js`, `src/game/leaderboard.js`. Existing match events have no production analytics consumer. Browser initials and record UUIDs must stay out of optional measurement. `docs/GO_TO_MARKET.md` is a proposal, not a working checkout.

## Accounts and owner decisions

### Create or approve now

1. **A Dropfall-owned Google administrator identity**, with MFA, recovery and a second authorised owner. Use it for Dropfall services; do not sign up through PDS product links or copy its tag containers. A dedicated login is operational separation, not proof of a separate legal publisher.
2. **A new Google Analytics account named Dropfall.** Recommended: five properties—Library, Dropfall Arena, Super Face Pop, Big Racers, moFighter—with one web stream each initially. Put both Arena URLs in the same game's property. Add native streams to the relevant game's property later. This is our reporting design, not a requirement for five Google logins. Account permissions inherit to properties, so do not place these properties in the PDS account. [GA account structure](https://support.google.com/analytics/answer/9679158?hl=en), [access inheritance](https://support.google.com/analytics/answer/9305587?hl=en).
3. **An eligible Dropfall AdSense publisher arrangement**, register `dropfall-game.com`, then apply for **H5 Games Ads** for in-game formats. Approval is not guaranteed and ordinary AdSense access does not grant H5 access. The game itself needs the approved placement API; adding a library banner does not monetize the four game tabs. [H5 application and eligibility](https://developers.google.com/ad-placement/docs/signup).
4. **A certified consent-management setup**, under Dropfall. Google's Privacy & messaging is a possible starting point within the publisher account; otherwise choose a certified CMP covering these domains, analytics choices and relevant regions. A homemade “Accept” button is not a substitute for the required certified TCF integration. [Google publisher CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en-GB).
5. **A separate Dropfall Stripe account**, if selling web ad removal or taking tips. Its products, receipts, statement descriptor, webhooks, customer records and reports must be separate from PDS. Stripe permits separate accounts for projects under the same actual legal entity; enter accurate business information. Do not enable PDS customer/payment-method sharing. [Stripe account separation](https://docs.stripe.com/get-started/account/multiple-accounts).

**Resolve this before advertising registration:** is Dropfall a separate registered business/payee, or a brand of the same business? AdSense generally permits one account per publisher; its documented separate-organisation exception is not permission to create a duplicate with another email. AdMob also has a one-account-per-user rule. Confirm the eligible arrangement with Google if PDS already has publisher accounts; do not reuse PDS accounts or create a prohibited duplicate to bypass the boundary. [AdSense accounts](https://support.google.com/adsense/answer/9729?hl=en), [AdMob accounts](https://support.google.com/admob/answer/9686306?hl=en).

The current library/Arena audience is general; still confirm launch regions and the legal controller/payee, and do not infer that every player is an adult or extend this audience decision to the other games.

### Later or optional—not needed just to launch web measurement

- **AdMob:** for native iOS/Android releases, with separate app registrations and game/platform-specific units in the eligible Dropfall publisher setup. Web games in a mobile browser are not native apps. Google's H5 WebView bridge specifically documents Android support; do not assume it covers iOS. [H5 app support](https://developers.google.com/ad-placement/docs/example).
- **Firebase:** dedicated Dropfall projects when native analytics/crash collection is implemented; no PDS project or shared user identifier. Analytics remains disabled until the appropriate choice permits it. Native UMP and iOS ATT are separate controls. [Firebase collection controls](https://firebase.google.com/docs/analytics/ios/configure-data-collection), [UMP](https://developers.google.com/admob/ios/privacy), [ATT/IDFA guidance](https://developers.google.com/admob/ios/privacy/idfa).
- **Google Ads / Meta Ads:** only if we choose to buy traffic. These are spending accounts, not the accounts that pay us for displaying ads. Use Dropfall-only billing, pixels and audiences; campaigns require an explicit budget and approval. Do not create them merely to start AdSense.
- **Reporting:** a Dropfall-only Looker Studio report can combine aggregate GA4, publisher and Stripe reports. No additional paid dashboard is needed initially. Any later error-monitoring/export service needs separate Dropfall project credentials, destinations and retention controls.

Public measurement/publisher IDs are configuration, not secrets, but their ownership must be checked. Use secure provider settings for secret keys and invite-based access for administration; do not paste payment secrets, bank details or recovery codes into chat.

## Strict separation contract

- Five explicit product IDs: `library`, `dropfall`, `super-face-pop`, `big-racers`, `mofighter`. Keep game-level reporting separate and combine **aggregates** for the portfolio.
- No PDS GA property, GTM container, Google-tag destination, Meta pixel, remarketing list, Customer Match upload, CRM, Firebase link, BigQuery export, webhook or Stripe link. A container with an innocent Dropfall label can still send to PDS: inspect destinations and linked products.
- Leave GA data-sharing options and Google signals off initially; check explicit product links separately. AdMob/Firebase linking can share data independently of the GA account's sharing settings. [GA sharing](https://support.google.com/analytics/answer/1011397?hl=en), [AdMob–Firebase links](https://support.google.com/admob/answer/6383165), [tag destinations](https://support.google.com/analytics/answer/12329709?hl=en).
- Use host-only, product-specific identifiers and consent stores by default. Do not widen identity cookies to a parent domain, reuse PDS user IDs, enable cross-business consent synchronisation or configure PDS cross-domain measurement. No cross-game user stitching is needed for the initial dashboard.
- Library and Arena share a hostname. Whether using separate properties or the supplied initial website stream, give their analytics cookies distinct product prefixes as well as host-only scope. Each page may load only its approved measurement destination. Do not broadcast events through a multi-destination Google tag.
- Allowlisted campaign labels may identify a library referral without identifying the player. No emails, names, room codes, restore tokens or raw query strings in URLs sent to analytics.
- Development/staging must use separate test properties and test ad mode; production activation uses an approved account inventory and network capture. No real ad clicks or charges in QA.
- Existing game copyright/developer credits are not advertising integrations. Existing Railway/Cloudflare/Sites infrastructure remains unchanged; operational hosting logs and their access/retention require a separate review. This audit does not claim that infrastructure is in a new legal company's accounts.

## Ad plan for every product

Default at launch: no forced pre-roll, no auto-ads over a canvas, no rewarded competitive advantage, and no interstitial while connected to a live multiplayer session. Save results before requesting an ad. A decline, blocked SDK or no-fill must leave the game playable.

| Product | Initial placement | Timing and exclusions |
| --- | --- | --- |
| Library | One clearly labelled display/sponsor slot after the collection | Separated from Play buttons; no launch interception, overlays or auto-refresh; hide empty inventory |
| Dropfall Arena | Completed offline match → next-match action | At most every third completed offline match, at least 8 active-play minutes between displays, max 2/session; no online queue/rematch/editor/VR play |
| Super Face Pop | Existing title sponsor slot; later completed offline match → replay action | Keep the dismiss control; no keyboard/gamepad double-activation; at least 8 active-play minutes and max 2/session for interstitials; no online sessions |
| Big Racers | Existing local hangar/event/results placement; optional next-race break after saved results | Reconcile/deploy the correct build first; no practice, countdown, paused race or online session; suppress all ad formats for verified ad-free players |
| moFighter | End of a solo arcade run → New Run action, after score entry | No first-fight ad, no local-versus ad, at least 8 active-play minutes and max 2/session; keep progression and score unchanged on no-fill |

These are conservative initial product policies, not provider-mandated frequency values or implemented settings. Measure whether they harm repeat play before increasing inventory. Children, unknown audience eligibility, denied consent, paid entitlements and a global/per-game kill switch must override them.

Use approved H5 API callbacks at real transition points. One request in flight; lock underlying navigation and held input; mute without overwriting the player's preference. Restore focus/audio/timing once after the provider confirms the ad is finished. Do not resume a game because a local timer expired while an ad is still visible. Log no-fill distinctly from an impression. [H5 placement policy](https://support.google.com/adsense/answer/9959170?hl=en), [callback contract](https://developers.google.com/ad-placement/apis/adbreak).

If H5 approval is unavailable, the fallback is a contracted, labelled static sponsor placement—not disguised auto-ads. House promotion can fill a slot but earns no booked revenue. Do not promise sponsor impressions until real delivery measurement exists.

## Consent and privacy release gate

Choose basic consent-gated loading initially: no optional analytics/ad SDK loads or pre-consent event replay. Separate analytics and advertising choices, an equally accessible refusal, persistent privacy controls and withdrawal. Google Consent Mode is a signal protocol, not a banner; advanced mode can send cookieless pings, so it is not equivalent to our proposed no-send default. [Consent Mode basics](https://support.google.com/analytics/answer/10000067?hl=en).

Publish accurate, product-specific privacy/storage information and a support contact before activation. Describe local saves, multiplayer names, online scoreboards, backend logs, payment records, vendor data, retention, deletion and controller identity; “no analytics today” does not mean “we collect no data”. Resolve regional and child-directed requirements with qualified review where necessary. Play Families requirements can restrict SDKs and identifiers for children/unknown ages; do not rely on a checkbox to waive them. [Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en).

Update each host's CSP deliberately for the chosen vendors—do not broadly add `unsafe-eval` or wildcard sources. Dropfall must retain `wasm-unsafe-eval` for its physics. Super Face Pop and moFighter need tested policy deployment; don't break module/style loads. Serve only real, provider-issued `ads.txt` entries at the root; use subdomain declarations when required by differing sellers. Do not publish invented publisher IDs. [Google ads.txt subdomain rules](https://support.google.com/adsense/answer/9785052?hl=en).

## Shared event dictionary — to implement

All names and values below are allowlisted, not free text. Add `product_id`, bounded release version, platform, mode and coarse device/quality tier where useful. Never include display names, initials, raw URLs/searches, room/invite IDs, email, input streams, restore codes, payment tokens or raw exception messages. Drop events before consent; do not persist a pre-consent queue.

Disable automatic form, search and outbound-link measurement until explicitly reviewed. Supply a sanitised page location without query strings or fragments and a safe referrer policy; an allowlisted custom event does not prevent a vendor's automatic page-view payload from leaking a room code. Validate the actual network payload, not only the event function arguments.

| Event | Exact meaning | Useful fields |
| --- | --- | --- |
| `library_view` | Library ready for use, once per page load | release |
| `game_details_view` | Player opens a game's details | game ID |
| `game_launch` | Player activates a verified Play link, not proof of loading | game ID, hero/card/dialog placement |
| `game_saved` | Bookmark toggled | game ID, saved boolean |
| `game_ready` | Game's title/menu usable | coarse load duration, device tier |
| `play_start` | Actual gameplay starts, not a countdown or menu click | final mode, built-in track/level category |
| `play_complete` | Match/race/run outcome committed | outcome enum, active-duration bucket |
| `play_abandon` | Explicit exit before completion | mode, progress bucket; close-tab inference reported separately |
| `load_failed` | Known loading/graphics failure | allowlisted error code, release; no arbitrary stack |
| `ad_opportunity` | Policy permitted an ad at a real transition | placement, mode |
| `ad_result` | Provider result, including not-ready/no-fill/error/viewed | placement, provider status; never infer revenue from this alone |
| `purchase_confirmed` | Server verified a real product entitlement | product, currency, amount, safe dedup key |
| `entitlement_restored` | Restore verified, not a new sale | product only |

Use explicit lifecycle events, not per-frame polling or damage-event spam. Exclude development/staging by configuration. Paid status suppresses ads but does not automatically consent to analytics. No gameplay loop may depend on a successful analytics request.

## Reporting and revenue operations

One Dropfall dashboard, filters for game/platform/release/date. Initial panels: library-to-game launches; game-ready/start/completion rates; active session length and replay rate; load failures; consented-sample coverage; eligible/requested/filled ads; provider-reported impressions/revenue; purchases/refunds/net receipts; hosting costs.

Publisher reports are the source of truth for ad earnings and invalid-traffic adjustments; Stripe/store reports are the source for receipts, fees, refunds and payouts. Keep house/sponsor/network income separate. Match currencies, time zones and reporting latency before calculating margins. GA is a behavioural sample, not financial reconciliation. Five properties cannot give a deduplicated portfolio user count without additional identity work; do not present summed users as unique people.

Suggested operating cadence after activation: daily automated collection/health checks, weekly game-by-game revenue and retention review, monthly account/destination/permissions reconciliation. This document does **not** schedule an automation or authorise ad spend. Later monitoring should be created explicitly once access and alert recipients exist.

## Ordered implementation and acceptance

1. Owner confirms business/payee, audiences, regions and contact; creates eligible separate accounts and supplies access/public IDs securely.
2. Record verified account destinations in `deployment/monetization-readiness.json`. This is an attestation backed by evidence, not self-verifying ownership. Run `node scripts/check-monetization-readiness.mjs`; `--require-ready` is the stricter release gate.
3. Ship privacy/settings and a consent-controlled analytics adapter in all five surfaces. Confirm accepted/refused/withdrawn behaviour, host-only scopes and no PDS destinations in real browser requests.
4. Add provider test-mode placements and lifecycle tests to each game; deploy one game at a time. Big Racers needs its Sites deployment reconciled; moFighter needs the runtime allowlist/release package rebuilt. Ordinary source edits alone do not update those published games.
5. Verify 360px phone and desktop flows; gameplay, pause, online rematch, audio, keyboard/gamepad/touch, adblock, offline, SDK error/no-fill and late callbacks. Test privacy choices on fresh and returning sessions. No repeated event/impression counting.
6. Add verified game-specific purchase/restore/refund support before selling ad-free. Existing Big Racers code is a starting point, not cross-game ownership. Never grant entitlement from a tip, checkout-return URL or localStorage flag. Native digital purchases need platform-appropriate billing, not an assumed reuse of web Stripe.
7. After provider approval, consent validation, ads.txt/CSP checks and account-boundary evidence, enable production per game. Confirm real reporting reaches the dedicated destination without clicking live ads. Keep rollback/kill switches independent of gameplay deployment.

Until steps 1–7 pass, say **not live**, not “ads enabled” or “analytics connected”. The present audit does not complete those integrations.

## Additional release risk

Dropfall's online scoreboard and custom levels currently use local server files on a service with no persistent volume. Public scoreboard was empty at pre-copy-deployment inspection; levels matched source apart from expected legacy API normalization. Establish persistent storage and a backup/restore procedure before introducing purchase entitlements or scaling traffic. Do not store financial access records in an ephemeral deployment directory.
