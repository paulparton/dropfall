# Dropfall library migration

## Serving contract

- `https://dropfall-game.com/`: game library, built from root `index.html`.
- `/dropfall-arena/`: original game, built from `dropfall-arena/index.html`.
- `/dropfall-arena` redirects with 308, preserving query parameters.
- `dropfall.dropfall-game.com` redirects only its root/index to `/dropfall-arena/` on the same origin.
- `/assets/`, `/api/`, `/health` and the root WebSocket endpoint remain origin-root.
- The game manifest retains its original identity with `id: "/"`; start URL and scope move to `/dropfall-arena/` so existing installations can update.
- Production serves the current `dist` directly. It never falls back to stale copied `server/public` game builds or sends HTML for missing assets. Operator tools remain separately access-controlled.

`npm start` builds and runs the server. `npm run start:prod` runs an already-built release. For development, use Vite and the existing multiplayer server setup documented in `server/README.md`.

## Catalog

Add or edit reviewed games in `src/library/catalog.js`. Each entry contains platform and control disclosures, modes, art, a safe launch URL and an available/preview/development status. Mobile means touch-enabled **browser** support, not an unverified native app release.

Every launch uses a new tab with `noopener noreferrer`. Search, filters, sorting and saved games are local UI features; bookmarks stay on the current device. There are no invented user accounts, purchases or ratings.

The no-JavaScript fallback in root `index.html` also contains launch links; keep these aligned with the catalog. Big Racers and moFighter are published as playable previews, not final releases.

## Hosting

Existing Railway project: `cf37bbf4-6f36-4185-817f-b47e9cd99ea4`.
Production environment: `d1ef6996-9647-4ac3-b1b6-baa5c8fff2d3`.

| Game/service | Service or Sites project | Verified public origin |
| --- | --- | --- |
| Dropfall + library | Railway `c6ea1a0a-4d8d-444d-91e1-2bf0c8aaf466` | https://dropfall-game.com |
| Super Face Pop | Railway `37ce107d-2554-4575-b9c8-a72589d416f8` | https://super-bubble-face-pop-production.up.railway.app |
| moFighter preview | Railway `16223a26-4832-4f2b-bc2a-10565878bf1e` | https://mofighter-production.up.railway.app |
| Big Racers preview | Sites `appgprj_6a9b76c2adbc81918c247628ab93ab7a` | https://big-racers-slipstream.agentdanimo.chatgpt.site |

Big Racers access was explicitly changed to public following user approval. Its existing published build was retained.

moFighter deployment `6fd7bcfd-1948-44b0-90a0-1f0e3cad437f` is healthy. The dependency-free runtime package came from `/Users/paulparton/Workbench/MoFighter`, commit `ac2cf4a8a26c0c2f70d644dff1900ebc0b2369e9` **plus its existing uncommitted work**. The source checkout was not changed. Stage: `/private/tmp/dropfall-mofighter-preview.eH7YxL` (temporary, not a long-term source archive). Its 197 runtime files total 78.29 MiB; initial menu is 3.29 MiB. Future previews must be built with that repository's release builder, not by uploading raw art/source archives.

## Cloudflare — game subdomains active

The requested custom domains are registered on their respective hosting services. **All nine DNS records were imported successfully** through the authenticated Chrome dashboard on 2026-09-09. The zone increased from 3 to 12 records; its original records were unchanged. The Cloudflare plugin was also installed, though its OAuth connection did not complete; DNS was configured through the dashboard.

Exact additive DNS records are in `deployment/game-dns-records.json`. Verification TXT values are intended for public DNS; no account credentials are stored here. Leave existing apex, email and unrelated records untouched. Inspect for conflicting records before creating or updating any exact hostname.

1. Authentication and additive import of four CNAMEs and five validation TXT records are complete (DNS-only, 300-second TTL).
2. Do not reimport blindly; first inspect exact hostname conflicts if reconciling these records later.
3. Railway reports all three game domains verified with VALID/COMPLETE certificates; Big Racers custom-domain status is active with active SSL (`appgdom_6aa148ba91888191bc856003d580dde6`).
4. HTTPS was verified for all four custom domains. Dropfall's root redirect and same-origin WebSocket greeting pass. Big Racers renders and connects its pilot profile. moFighter's menu, script and sprite match the source deployment.
5. Catalog and no-JS fallback now use the three branded game URLs. Original provider URLs are retained as `originUrl` metadata. Dropfall's library launch remains `/dropfall-arena/` to preserve existing same-origin profiles/saves.
6. Super Face Pop's `PUYO_ALLOWED_ORIGINS` now includes `https://super-face-pop.dropfall-game.com`. Its previous entries (`https://dropfall-game.com` and `https://super-bubble-face-pop-production.up.railway.app`) are preserved. The final same-origin WebSocket check returned `hello.ok`, protocol 2, after the configuration rollout. No test rooms were created.

The initial library release used verified provider origins while certificates activated. The final release switches to verified branded domains; no fake coming-soon launch links are used.

Initial library release `6bcefdd4-0fc5-4ab8-920b-c94971f9d7b9` is SUCCESS and was verified at the main domain. Before deployment, live public data was compared with source: the empty online scoreboard had no entries, eleven levels matched, and the edited 218-tile geometry for `draft_1785572834902` was preserved in source. Its previous 325-tile version remains recoverable in Git. Future online scores/custom levels still need a persistent storage strategy; the existing Dropfall service currently has no Railway volume.

Final branded-link/PWA compatibility release: `d6315b4d-601c-4802-9f65-4da66bf135db`, SUCCESS. Production browser checks confirm all five hero/card launch links use the intended arena path or branded game hostname and include `target="_blank"` with `rel="noopener noreferrer"`. The final suite passed 398 tests in 32 files, type-checking, asset validation and production build. Existing Three.js/Rapier deprecation and large game-chunk warnings remain; no initialization errors were observed.

Super Face Pop origin configuration rollout: `28fffe33-2cbb-4f84-8e16-9a83dfcd3e69`, SUCCESS. No source changes were made to that game and its existing origins were retained.

## Deploy / rollback

### 10 September AdSense verification

Release `82ec2096-1de5-401d-b4dd-15a44477e789` is SUCCESS. It publishes the root verification meta tag and `/ads.txt` for owner-supplied publisher `pub-7669551026428141`; both were checked over public HTTPS. AdSense then confirmed **Your site is verified**. Review submission/status is recorded in `docs/ADSENSE_SETUP.md`. No advertising SDK or automatic ad placement is enabled by this release. Validation: 525 tests in 37 files, type-check and production build passed. All 12 levels matched source before upload and the online scoreboard was empty.

### 10 September Analytics activation

Release `b5418115-93ca-4ab1-9a15-942063073976` is SUCCESS. After the owner confirmed a general audience and `dropfallgamestudio@gmail.com`, the Dropfall service build variable `VITE_DROPFALL_ANALYTICS_ENABLED=true` was set and the notice updated. Live shared analytics bundle hash matches local. Fresh library/Arena pages had no Google tag before consent; refusal kept it absent; separate opt-ins loaded the correct tag. Google Realtime in account `407483272`, property `553499991` confirmed both page titles, two page views, `library_view` and `game_ready`. No ads or other-game integrations were enabled. Full network/payload and broader remote-account audit items remain in `ANALYTICS_SETUP.md`.

Before deployment all 12 levels matched source and the scoreboard was empty. The corrected notice's focused tests and enabled production build passed; see the analytics runbook for final regression results. This supersedes the default-off release status below.

### 10 September dedicated Analytics setup (historical default-off releases)

The library and Arena opt-in integration is deployed but **collection is off**. The verified tag is `G-HSDS6QM123` in dedicated account `407483272`, property `553499991`; no ads or other game integrations were activated. The build flag `VITE_DROPFALL_ANALYTICS_ENABLED` is unset. Audience confirmation, controller/privacy-contact details and the remaining activation checks are recorded in `docs/ANALYTICS_SETUP.md`.

Initial integration release `e18a84af-4abf-464c-8180-695072a00508` and final privacy-dialog release `05326c79-bc8c-4d0d-8392-d2a023f3f8d9` both reached SUCCESS. Validation: 523 tests in 36 files, type-check, focused ESLint, production build and diff check. Live library privacy controls report collection off; no Google Analytics script element is loaded, the script-free `/privacy.html` notice returns 200, and Arena initializes without reported console errors. The pre-deploy scoreboard was empty and all 12 levels matched source. The temporary local QA server was stopped.

The new technical notice is not a complete legal privacy policy, and no GA event receipt is claimed while collection is disabled. A separate Cloudflare beacon element observed in the browser remains an infrastructure/ownership follow-up; it was not introduced by this integration and the returned site CSP does not allow its origin.

### 10 September copy and monetization audit pass

The revised library copy is live in deployment `335f9e7b-66c7-4155-a329-42845a854b91` (SUCCESS), following initial copy release `a2a8bd28-4fe7-4e04-8fb1-c6fb32826f7f`. The final live library bundle matches the validated local build. Browser checks confirm the new headline, four cards, safe new-tab destinations and no console errors. The 360px CSS-width layout and detail dialog have no horizontal overflow. Validation: 420 tests in 33 files, type-check, production build and diff check.

Before publication, the online scoreboard was empty and all 12 levels matched source after accounting for the API's expected `active: true` legacy-level normalisation. No gameplay source or data migration was introduced in this pass.

The advertising/analytics review is in `docs/DROPFALL_REVENUE_ANALYTICS.md`. `npm run check:monetization` reports the missing approvals and integrations; `node scripts/check-monetization-readiness.mjs --require-ready` intentionally fails while blocked. This is an offline checklist, not a live SDK integration. No tracking, paid ads, campaigns or payment accounts were activated. The Super Face Pop and Big Racers local setup guides now supersede their old PDS-shared Stripe instructions; neither game's deployment was changed.

Build and validate before uploading:

```sh
npm test
npm run type-check
npm run validate:assets
npm run build
npx --yes @railway/cli up --project cf37bbf4-6f36-4185-817f-b47e9cd99ea4 --environment production --service dropfall --detach --json
```

The upload ignore file excludes local credentials, dependencies, generated builds, private state and QA output. Railway rebuilds from source using the existing `railway.json`.

Verify deployment status is SUCCESS, then check root HTML, arena HTML, the slash redirect, current hashed assets, health, and a read-only WebSocket connection. The pre-migration Dropfall deployment was `939a2cd1-7cbc-471f-8467-f08b65c2f74b`; Railway can redeploy that exact prior release if rollback is needed. No apex DNS migration is necessary.
