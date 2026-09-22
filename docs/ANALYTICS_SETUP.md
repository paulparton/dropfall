# Dropfall analytics setup and activation runbook

Updated: 10 September 2026.

**Status: production opt-in collection enabled and Google Realtime receipt verified on 10 September 2026.** The owner confirmed a general audience and `dropfallgamestudio@gmail.com` as the contact. Deployment `b5418115-93ca-4ab1-9a15-942063073976` is SUCCESS with `VITE_DROPFALL_ANALYTICS_ENABLED=true`. The live shared analytics bundle matches the tested local bundle.

Live browser checks: neither surface inserted a Google tag before consent; library refusal also left the tag absent. After separate affirmative choices, both surfaces loaded the intended `G-HSDS6QM123` tag with the custom data layer. The library details UI and Arena menu remained functional, with no reported analytics/CSP errors. The dedicated property's Realtime report then showed `page_view` (2), `library_view` (1), and `game_ready` (1), with both expected page titles. The two active users in this test reflect separate product identifiers, not two people. This verifies page/readiness delivery, not every gameplay event or all network payloads. QA consent was withdrawn afterward; the library dialog correctly switched to off. Historical clicks are not replayed.

The published privacy contact renders correctly. Source privacy HTML has no authored scripts, but Cloudflare email obfuscation/beacon injection changes the served document; do not describe the complete production document as script-free. The separate beacon's ownership/operation remains an infrastructure follow-up, not part of the verified Google integration.

Final activation regression: **530 tests passed in 38 files**, type-check and diff check passed; the enabled production build passed before deployment. The offline monetization checklist still blocks ads/payments and the three other games as intended.

This runbook covers the game library and Dropfall Arena only. It does not activate advertising, purchases, or analytics inside Super Face Pop, Big Racers, or moFighter. A library click opening one of those games is library measurement, not instrumentation of the destination game.

## Account and destination inventory

The following identifiers were verified in the authenticated Google Analytics UI during setup. They are public configuration identifiers, not credentials.

| Resource | Verified value |
| --- | --- |
| Analytics account | `407483272` — `dropfall games` |
| GA4 property | `553499991` — `dropfall-store` |
| Web stream | `15750213019` — website `https://dropfall-game.com` |
| Measurement ID used by the code | `G-HSDS6QM123` |
| Associated Google tag | `GT-5R8H8TBW` |

Do not use the numeric stream ID in the script URL. The code pins the `G-` measurement ID and explicitly routes each manual event to it.

### Deliberate scope change from the earlier recommendation

`docs/DROPFALL_REVENUE_ANALYTICS.md` proposed five properties, one per product. This implementation instead uses the owner's supplied web stream for **two surfaces in one property**, distinguished by `product_id: library` or `product_id: dropfall`. The other three games remain outside this integration.

Separate host-only cookie prefixes and product-specific choices avoid intentionally sharing browser identifiers between the library and Arena. They do not create separate GA properties. Reports are aggregated in the same property, and a library launch is not a joined user journey or proof of Arena readiness. Do not present combined users as deduplicated people or infer conversion attribution across surfaces. No shared `user_id`, imported `client_id`, or cross-domain identity linker is configured.

## Source map

| File | Responsibility |
| --- | --- |
| `src/services/analytics.js` | Destination, exact page allowlist, bounded payloads, consent, storage, cookies, loading, opt-out, expiry |
| `src/components/AnalyticsConsent.js` and `analytics-consent.css` | Optional banner and persistent privacy-choice dialog |
| `src/library/main.js` | Library readiness, details, saves, and launch-click hooks |
| `src/services/gameAnalytics.js` | Match lifecycle observer, consent-qualified starts and completions |
| `src/main.js` | Arena setup and lifecycle wiring; editor playtests are excluded |
| `public/privacy.html` | Technical analytics/storage notice, served without an analytics script |
| `server/security.js` and `server/server.js` | Route-scoped Google script/collection CSP permissions and no-referrer policy |

## Activation switch and route scope

Only the exact build-time string below enables the integration:

```sh
VITE_DROPFALL_ANALYTICS_ENABLED=true npm run build
```

Unset, `false`, or any other value leaves it off. Vite substitutes this value into the bundle: changing a running server's environment without rebuilding does not change an already-built client. This is a public feature flag, not a secret.

Even in an enabled build, loading requires all of the following:

- A recognized product and production HTTPS hostname, using the default HTTPS port or `443`.
- An allowlisted document: library `/` or `/index.html`; Arena `/dropfall-arena/` or `/dropfall-arena/index.html`.
- Library host `dropfall-game.com` or `www.dropfall-game.com`; Arena may also use `dropfall.dropfall-game.com`.
- Affirmative, unexpired analytics consent for that product on that origin.
- No detected Global Privacy Control or `navigator.doNotTrack === '1'` at initialization, and no conflicting existing Google tag/data layer.

The server redirects the Arena's slashless URL and the game subdomain's root to their canonical Arena document. The helper also recognizes `/privacy.html` for sanitized page metadata, but the current static privacy notice does not instantiate the analytics service. Localhost, provider preview hostnames, unrelated routes, and the other game subdomains do not pass the runtime allowlist.

## Consent, cookies, and withdrawal

This uses **basic consent-gated loading**. Before opt-in the adapter does not fetch `gtag.js`, send Google Analytics requests, or save events for later replay. It does not insert a preconnect or DNS-prefetch for the tag. This guarantee concerns this analytics integration, not functional hosting, fonts, security, or multiplayer network traffic. Advanced denied-mode collection would not meet this no-send design. [Google consent setup](https://support.google.com/analytics/answer/14009635?hl=en)

| Setting | Library | Arena |
| --- | --- | --- |
| `product_id` | `library` | `dropfall` |
| localStorage choice key | `dropfall:analytics-consent:v1:library` | `dropfall:analytics-consent:v1:dropfall` |
| Analytics cookie prefix | `dropfall_library` | `dropfall_arena` |
| Choice validity | Up to 180 days | Up to 180 days |
| Cookie configuration | Host-only, path `/`, Secure, SameSite=Lax; 28-day configured expiry; no renewal on each visit | Same |

Choice records contain a schema version, `granted`/`denied`, and a timestamp. Missing, malformed, future-dated, or expired records become unknown and do not authorize loading. Storage failures fall back to the current document's in-memory choice; do not promise persistence when browser storage is unavailable. Browser site-data controls remain the fallback for removing inaccessible/stale stored choices.

The library and Arena have **separate choices**, including when they share a hostname. Choices are origin-local; they are not synchronized between the apex and game subdomain. Same-origin tabs receive relevant storage changes. The service rechecks on page restoration/visibility changes, before manual events, and with bounded expiry timers. Browser suspension can delay timers; lifecycle checks remain necessary.

Withdrawal immediately sets `window['ga-disable-G-HSDS6QM123'] = true`, disables app event delivery, clears the adapter's command queue and expiry timer, and attempts to expire only the current product's prefixed host cookies. It does not load a tag or send a denied-mode ping just to report refusal. If withdrawal occurs during initial script loading, that partly initialized runtime is not revived on the same document.

An already-executed vendor runtime remains in memory; it is disabled rather than unloaded. Regrant after a fully loaded runtime reuses that runtime. Test automatic events and regrant behavior in a real browser, not just the public command queue. Withdrawal cannot recall in-flight requests or erase data already held by Google. The opt-out flag is a documented Google control, not proof of server-side deletion. [Google privacy controls](https://developers.google.com/tag-platform/security/guides/privacy)

## Data and PDS separation

The adapter uses `dropfallAnalyticsLayer`, never a shared global `gtag`/default `dataLayer`. It refuses startup if it detects another tag/layer. Only one controller owns each document. It fixes `send_to` to the supplied measurement ID, does not accept caller destination overrides, and constructs payloads from approved fields rather than forwarding arbitrary objects.

Page addresses are canonical origin/path values without query strings or fragments; page titles are fixed; `page_referrer` is empty. Manual events exclude player names, profiles, scores, searches, room/invite codes, emails, and raw URLs. There is no custom user ID or advertising identifier. This is **not anonymous measurement**: Google receives connection/device/browser information and generates its own session and engagement information.

Code-level settings:

- `send_page_view: false`, with a manual sanitized initial page view.
- `allow_google_signals: false` and `allow_ad_personalization_signals: false`.
- `ad_storage`, `ad_user_data`, and `ad_personalization` remain denied; only `analytics_storage` can become granted.
- `linker: { domains: [], accept_incoming: false, decorate_forms: false }` and `url_passthrough: false`.
- `ads_data_redaction: true` as defense in depth; this is not a substitute for GA payload sanitization and does not activate an ad product.
- `cookie_domain: 'none'`, product-specific `cookie_prefix`, `cookie_expires: 2419200`, and `cookie_update: false`.

Google documents the cookie controls and custom-layer mechanism. [Cookie settings](https://developers.google.com/tag-platform/security/guides/customize-cookies), [GA4 configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [Custom data layer](https://developers.google.com/tag-platform/tag-manager/datalayer)

Local code cannot prove remote separation: a Google tag can have multiple destinations, and linked products/access grants can share data independently. Do not combine this tag with PDS, add PDS destinations, copy PDS user IDs/audiences, or connect PDS Ads, Firebase, BigQuery, publisher, payment, or campaign resources. [Tag destinations and routing](https://developers.google.com/tag-platform/gtagjs/reference), [Data-sharing settings](https://support.google.com/analytics/answer/1011397?hl=en)

The server only grants Google script/collection permissions on the library and Arena entry routes. The approved loader is `https://www.googletagmanager.com/gtag/js`; collection origins are `https://www.google-analytics.com` and `https://region1.google-analytics.com`. Editor/admin policy does not gain these permissions. CSP permission does not itself load a resource or grant consent. Do not broaden the policy to ad networks or arbitrary Google tags to make a test pass.

Production browser inspection also found a `static.cloudflareinsights.com` beacon element that is not in this repository's HTML or the direct HTTP response examined. Its ownership and execution have not been established; the site's returned CSP does not allow its script/collection origin, and this implementation adds no Cloudflare beacon permission. Review hosting/browser injection and Cloudflare Web Analytics ownership before claiming that **all** site analytics are isolated or inactive. This is separate from the confirmed absence of a loaded Google Analytics script in the default-off release.

## Implemented event dictionary

Every manual event adds `product_id`, sanitized `page_location`, fixed `page_title`, empty `page_referrer`, and the fixed `send_to`. Events attempted without valid consent or before tag readiness are dropped.

| Event | Surface | When sent | Additional fields |
| --- | --- | --- | --- |
| `page_view` | Both | Once when the consented tag is ready for the document | None |
| `library_view` | Library | Render completed and consented tag is ready | None |
| `game_details_view` | Library | A known game's details dialog opens | `game_id` |
| `game_saved` | Library | Bookmark toggled | `game_id`, boolean `saved` |
| `game_launch` | Library | Ordinary or middle-button activation of an instrumented play link | `game_id`, `placement` |
| `game_ready` | Arena | Successful initialization and consented tag readiness | None |
| `play_start` | Arena | First `COUNTDOWN` → `PLAYING` transition of an explicitly armed match | `mode` |
| `play_complete` | Arena | `GAME_OVER` for a match whose start was accepted under consent | `mode` |

Allowed game IDs: `dropfall`, `super-face-pop`, `big-racers`, `mofighter`. Placements: `hero`, `card`, `dialog`. Modes: `solo`, `local`, `online`, `unknown`.

`game_launch` means a link was activated, not that its destination loaded. New-tab navigation never waits for analytics. `game_saved` reflects the current UI bookmark state, not proof that browser persistence succeeded.

Arena rounds are not separate match completions. Consent granted mid-match does not retroactively emit a start/completion pair. Withdrawal disqualifies the current match even if consent is later granted again. Restart/disconnect/menu transitions discard the prior match, and editor playtests are excluded. **No abandonment event is wired.** The validator permits `play_abandon` and an optional bounded completion `outcome`, but the current observer emits neither. No duration, score, player identity, error text, or per-frame telemetry is sent.

Enhanced Measurement is disabled remotely, but GA can still create automatic session/engagement events. Do not describe this table as an exhaustive list of all Google-generated records.

## Remote settings: evidence versus outstanding checks

Verified through the authenticated UI on 10 September 2026:

- Account/property/stream/tag inventory above.
- Enhanced Measurement off for this web stream.
- Zero connected site tags.
- All four account data-sharing options off.
- The Google tag's Manage destinations table contains exactly one website destination: `G-HSDS6QM123`, linked to property `553499991`.
- Google signals and property-level user-provided data collection off; neither was activated.
- The Google tag's separate "Allow user-provided data capabilities" setting disabled, saved, and reopened to verify it remained off.
- Property advertising personalization disallowed in all 307 available regions; the saved UI shows 0 of 307 allowed.
- Event and user data retention set to two months, with "Reset on new user activity" off. Google says changes take effect after 24 hours and do not affect most standard aggregate reports; this is not a claim that all Google-held data disappears after two months.

These settings are a dated configuration snapshot, not an immutable guarantee. Zero connected site tags alone is not equivalent to verification of all tag destinations or linked products.

Remote audit checklist (unchecked items remain follow-ups, not completed claims):

- [x] Exact Google-tag destination list contains only the intended Dropfall stream. Recheck before activation and after future account/tag changes.
- [ ] Account/property access and product links exclude PDS resources and unapproved recipients.
- [x] Google signals, both user-provided-data controls, and advertising personalization are off. Recheck before activation.
- [x] Event/user data-retention settings deliberately chosen and documented above; cookie expiry does not control Google's server retention.
- [x] Enhanced Measurement is off. Keep it off, including history-change page views, site search, forms, outbound links, video, scrolling, and downloads.
- [ ] Redaction options and any custom event-creation/modification rules have been reviewed; no rule reintroduces sensitive fields.
- [ ] Any desired custom dimensions, such as `product_id`, `game_id`, `placement`, `mode`, and `saved`, are explicitly configured and verified. Their registration is not claimed by this implementation.

`send_page_view: false` does not suppress Enhanced Measurement's independent history-change events; this is why the remote check is required. [Manual page-view controls](https://developers.google.com/analytics/devguides/collection/ga4/views)

## Privacy and audience decision

The owner confirmed a **general audience** and contact **dropfallgamestudio@gmail.com** on 10 September 2026. The published notice uses **Dropfall Game Studio** as a public brand, not a claim about the registered legal entity. `public/privacy.html` explains the technical collection and controls. It is **not a complete, legally reviewed controller privacy policy**. Remaining policy work includes:

- The operating/legal controller's formal identity and response procedures.
- Reassessing the general-audience designation if either product becomes child-directed or knowingly serves children requiring a different approach.
- Applicable regional consent, retention, rights/deletion, international processing, and children's-privacy requirements.
- Whether the technical notice needs to be supplemented with controller information, backend/multiplayer/account data practices, and response procedures.

Do not infer that unknown ages are adults or that a normal analytics-accept button establishes parental consent. Analytics consent does not authorize advertising, and an ad-free purchase would not authorize analytics either. Google's children's-designation tools do not replace the publisher's legal obligations. [Child-directed guidance](https://support.google.com/policies/answer/9664901?hl=en), [GA privacy terms](https://marketingplatform.google.com/about/analytics/terms/us/)

## Historical default-off verification and repeatable release procedure

Local validation completed on 10 September 2026: **523 tests passed in 36 files**, full type-check, production build, focused ESLint, and diff check passed. Tests using a mocked tag validate the adapter, not Google's actual collection behavior.

Default-off integration deployment `e18a84af-4abf-464c-8180-695072a00508` succeeded, followed by final dialog-layout release `05326c79-bc8c-4d0d-8392-d2a023f3f8d9` (SUCCESS), both with the activation variable unset. Live browser checks confirm the privacy dialog says analytics is off, the library has no Google Analytics script element, and Arena initializes with no reported console errors. The technical notice returns 200 without scripts. Local responsive DOM checks at 360 CSS pixels show no document/dialog horizontal overflow; desktop appearance was visually inspected. Production GA receipt has **not** been verified because collection remains off.

1. Complete the audience/privacy and remote-setting checks above. Obtain the owner's activation decision; keep the default-off build until then.
2. Run the focused and full checks from the repository root:

   ```sh
   npm test -- tests/analytics.test.ts tests/analytics-consent.test.ts tests/game-analytics.test.ts tests/library-ui.test.ts tests/server-security.test.ts tests/site-routing.test.ts
   npm test
   npm run type-check
   npm run build
   git diff --check
   ```

3. Test an enabled candidate with an approved test destination/environment strategy. Do not override the production host guard or use real ads merely to make local testing convenient.
4. In a clean browser verify default/unknown, refusal, opt-in, reload, expiry, storage-unavailable, cross-tab withdrawal, withdrawal during script load, withdrawal after load, and regrant. Before opt-in/refusal there must be no tag request, collection request, analytics cookie, or queued action replay. Verify game access is unchanged.
5. After opt-in inspect actual requests: only the intended destination, sanitized URL/referrer/title, bounded fields, host-only product cookies, no PDS identifiers, no ad/join beacons, and no `_gl` decoration. Exercise history changes and forms/searches to catch unexpected automatic collection. Check CSP without adding broad exceptions.
6. Verify one page view/readiness event per document, correct library placements, match-not-round counting, and no editor-test or pre-consent match replay. Test after withdrawal and regrant with the real vendor runtime.
7. Set `VITE_DROPFALL_ANALYTICS_ENABLED=true` in the **Dropfall library/Arena service's build environment only**, rebuild, and deploy using `docs/LIBRARY_DEPLOYMENT.md`. Do not modify the three separate game deployments.
8. Verify the deployed bundle and actual browser requests, then confirm approved test events in the intended property's Realtime/DebugView or appropriate reports. Script `load`, a true return from `track()`, or an HTTP request alone does not prove reporting receipt. Record the release ID, verification time, destination, and result before calling analytics live.

Do not enable global debug traffic for ordinary players, collect raw personal data for testing, or click live ads. Diagnostic captures can contain identifiers; redact them before sharing.

## Disable / rollback

For an individual visitor, use **Privacy choices → Disable analytics** on the relevant surface. This leaves game features available and removes only that product's analytics cookies on the current host.

For a release rollback:

1. Remove the build variable or set `VITE_DROPFALL_ANALYTICS_ENABLED=false` for the Dropfall service.
2. Rebuild and redeploy, or redeploy a verified default-off artifact. For a local build:

   ```sh
   VITE_DROPFALL_ANALYTICS_ENABLED=false npm run build
   ```

3. Verify fresh/reloaded library and Arena documents do not load Google Analytics even with an old saved grant. Preserve functional profiles, saved games, levels, and scores.
4. Record why collection was disabled and the affected release. Do not delete GA properties or unrelated cookies as an emergency shortcut.

The build flag is **not a remotely polled instantaneous kill switch**. Already-open documents retain their loaded code until withdrawal, expiry, navigation/reload, or closure. A rollback cannot recall previously sent data. If active-session termination is required operationally, design and verify a separate runtime control before claiming that capability.
