---
plan: 260714-ohl
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main.js
  - package.json
  - tests/e2e/game.e2e.js
autonomous: true
requirements: [E2E-01]
must_haves:
  truths:
    - Running `npm run test:e2e` launches the Dropfall game in a headless browser, starts a single-player match, and asserts the player moves in response to keyboard input.
    - The e2e test spins up its own Vite dev server (no manual server step) on port 5174 and tears it down after.
    - The existing unit tests (`npm test`) are unaffected and do not attempt to launch the browser.
  artifacts:
    - tests/e2e/game.e2e.js
    - "test:e2e" npm script in package.json
    - dev-only debug snapshot on window.__DROPFALL_DEBUG__ in src/main.js
  key_links:
    - "Puppeteer -> Vite dev server (http://localhost:5174) -> index.html -> /src/main.js"
    - "window keydown {code:'KeyD'} -> src/input.js keys[] -> Player.update forces -> mesh.position -> window.__DROPFALL_DEBUG__"
---

<objective>
Add end-to-end / interaction tests that launch Dropfall in a real headless browser (Puppeteer), start a single-player game, simulate keyboard movement of player 1, and assert the player actually moves — observable via a minimal dev-only debug hook.

Purpose: Give the project a true browser-level smoke test that catches WebGL/physics/init regressions the existing jsdom unit tests cannot see.
Output: `tests/e2e/game.e2e.js`, a `test:e2e` npm script, a dev-only `window.__DROPFALL_DEBUG__` snapshot in `src/main.js`, and `puppeteer` as a devDependency.
</objective>

<execution_context>
@/Users/paulparton/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/paulparton/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@package.json
@vite.config.js
@vitest.config.js
@index.html
@src/main.js
@src/input.js
@src/store.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dev-only debug hook, puppeteer devDependency, and test:e2e script</name>
  <files>src/main.js, package.json</files>
  <action>
Play start: Player positions live only in module-scoped `let player1, player2` inside `src/main.js` (declared near line 201) and are NOT exposed on `window`, so a Puppeteer test cannot read them. Add a minimal, dev-only snapshot so the e2e test can observe game state.

1. In `src/main.js`, inside `function animate(_timestamp, _frame)` — which starts at line 1844 — insert the following block IMMEDIATELY after the line `const state = useGameStore.getState();` (line 1846), before the `if (state.gameMode === 'ONLINE' ...` check:

```js
    // Dev-only snapshot for e2e/interaction tests. Pruned from production builds by Vite.
    if (import.meta.env && import.meta.env.DEV) {
        window.__DROPFALL_DEBUG__ = {
            gameState: state.gameState,
            gameMode: state.gameMode,
            players: [
                player1
                    ? { id: 'p1', x: player1.mesh.position.x, y: player1.mesh.position.y, z: player1.mesh.position.z, dead: !!player1.isDead }
                    : null,
                player2
                    ? { id: 'p2', x: player2.mesh.position.x, y: player2.mesh.position.y, z: player2.mesh.position.z, dead: !!player2.isDead }
                    : null,
            ],
        };
    }
```

Rationale: `import.meta.env.DEV` is statically replaced with `true` in `vite`/`vite dev` and `false` (with the block tree-shaken) in `vite build`, so this never ships to production or to the Electron/Railway builds. It only reads existing `player1.mesh.position` / `player1.isDead` — no behavior change. Do not export `useGameStore` or any internals beyond gameState/gameMode/positions.

2. In `package.json`:
   - Add to `devDependencies`: `"puppeteer": "^23.0.0"` (this package auto-downloads a compatible Chromium into `~/.cache/puppeteer` on `npm install`; no separate `puppeteer-core`/system-Chrome wiring needed).
   - Add to `scripts`: `"test:e2e": "vitest run tests/e2e/game.e2e.js"`.
     NOTE: the e2e file is named `game.e2e.js` (not `*.test.js`) on purpose — the existing `vitest.config.js` include glob is `tests/**/*.test.{js,ts}`, so plain `npm test` will NOT pick this file up and will NOT try to launch a browser. `test:e2e` passes the path explicitly on the CLI, which overrides `include`.

3. Run `npm install` so puppeteer and its Chromium download. Expect a ~150MB Chromium download the first time (network prerequisite; harmless on subsequent installs). Do NOT commit `package-lock.json` churn beyond the puppeteer additions.
  </action>
  <verify>
    <automated>node -e "require('puppeteer')" && grep -c '__DROPFALL_DEBUG__' src/main.js | grep -q '[2-9]' && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts['test:e2e']"</automated>
  </verify>
  <done>
    - `src/main.js` contains the dev-guarded `window.__DROPFALL_DEBUG__` snapshot inside `animate()` (2+ occurrences of the token: the assignment target + the read references).
    - `package.json` has `puppeteer` in devDependencies and a `test:e2e` script equal to `vitest run tests/e2e/game.e2e.js`.
    - `node -e "require('puppeteer')"` resolves (Chromium downloaded).
    - `npm test` still runs the existing jsdom unit suite unchanged (the e2e file is outside the default include glob).
  </done>
</task>

<task type="auto">
  <name>Task 2: Write the Puppeteer e2e/interaction test</name>
  <files>tests/e2e/game.e2e.js</files>
  <action>
Create the file `tests/e2e/game.e2e.js` (directory `tests/e2e/` does not yet exist — create it). The test must drive the REAL game in a headless Chromium: spin up its own Vite dev server, navigate, start a single-player match, move player 1 with keyboard events, and assert observable movement via the `window.__DROPFALL_DEBUG__` hook added in Task 1.

The file body MUST begin (line 1) with the vitest environment pragma so it runs under Node (not the project's default jsdom):

`// @vitest-environment node`

Implementation requirements (write this as one `describe('Dropfall e2e', ...)` with `beforeAll`/`afterAll` + one `it('starts a game and moves the player', ...)`):

- Imports: `{ describe, it, expect, beforeAll, afterAll }` from `vitest`; `puppeteer` default import; `{ createServer }` from `vite`.
- `beforeAll` (async):
  - Start the dev server programmatically:
    `server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5174, strictPort: true, host: '127.0.0.1' } });`
    then `await server.listen();`. Use port 5174 (not the project default 5173) so it never clashes with a developer's running `npm run dev`. `strictPort: true` fails fast if the port is taken rather than silently picking another port the assertions won't know about.
  - `browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });`
    The `--use-angle=swiftshader` args are required: the game uses a Three.js WebGLRenderer and Rapier3D WASM; headless Chrome needs software WebGL (SwiftShader) for `initRenderer()` to succeed and `showScreen('menu')` to be reached.
  - `page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });`
  - Set a generous default nav timeout: `page.setDefaultTimeout(20000);`
- `afterAll` (async, guard with `?.`): `await browser?.close(); await server?.close();`

- Inside the `it`:
  1. `await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });`
  2. Wait for the main menu to be visible (the page's `init()` ends with `showScreen('menu')` which removes `hidden` from `#menu`):
     `await page.waitForFunction(() => !document.getElementById('menu')?.classList.contains('hidden'), { timeout: 20000 });`
     If this times out, WebGL/init failed — the test correctly fails.
  3. Start single player: `await page.click('#mode-single-btn');`
     `setGameMode('1P')` transitions `gameState` to `NAME_ENTRY` (see src/store.js setGameMode → nextState = 'NAME_ENTRY').
  4. Wait for the name-entry screen: `await page.waitForFunction(() => !document.getElementById('name-entry')?.classList.contains('hidden'));`
  5. Tap "READY UP": `await page.click('#name-entry-play-btn');`
     This calls `proceedFromNameEntry()` (async; loads an optional level then `startGame()` → `resetEntities()` → COUNTDOWN → PLAYING). Level-load failures are caught internally and fall back to the default arena, so this is robust even with no editor server running.
  6. Wait for the HUD to be visible, which only happens once `gameState === 'PLAYING'` (after the 3-2-1 countdown completes via `useGameStore.getState().setPlaying()`):
     `await page.waitForFunction(() => !document.getElementById('hud')?.classList.contains('hidden'), { timeout: 25000 });`
  7. Wait until both players spawned + positions are reported by the debug hook:
     `await page.waitForFunction(() => { const d = window.__DROPFALL_DEBUG__; return d && d.players && d.players[0] && d.players[1] && !d.players[0].dead && !d.players[1].dead && Number.isFinite(d.players[0].x); }, { timeout: 20000, polling: 100 });`
  8. Record player 1 starting position:
     `const start = await page.evaluate(() => { const p = window.__DROPFALL_DEBUG__.players[0]; return { x: p.x, z: p.z }; });`
  9. Move player 1 to the right by dispatching the exact `KeyboardEvent` the game listens for on `window` in `src/input.js` (`keys[e.code]`). Use `page.evaluate` to synthesize the event with the correct `code` so there is no reliance on Puppeteer's key-name mapping:
     ```
     await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true })));
     await new Promise(r => setTimeout(r, 600));
     await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true })));
     await new Promise(r => setTimeout(r, 400));
     ```
  10. Read the new position: `const after = await page.evaluate(() => { const p = window.__DROPFALL_DEBUG__.players[0]; return { x: p.x, z: p.z }; });`
  11. Assert observable horizontal displacement to be robust to camera-relative movement direction (the "right" input is applied along the camera's local basis, so either x or z will change):
      `const moved = Math.hypot(after.x - start.x, after.z - start.z);`
      `expect(moved).toBeGreaterThan(1.0);` (sphereAccel default is 2000; 600ms of input reliably moves the ball well past 1 unit on the xz plane. 1.0 is a conservative threshold that still rejects "didn't move at all" while tolerating minor physics jitter.)
  12. For a second-direction sanity check (optional but recommended), repeat the same gesture with `code: 'KeyW'` (forward) and assert further xz movement beyond the first reading:
      `start2 = after;` → dispatch KeyW keydown for 600ms → keyup → wait → `after2` → `Math.hypot(after2.x-start2.x, after2.z-start2.z) > 1.0`.

Keep the test self-contained: no reads of project source files, no coupling to internal module exports. The only contract with the app is: DOM ids `#menu`, `#mode-single-btn`, `#name-entry`, `#name-entry-play-btn`, `#hud`, and the `window.__DROPFALL_DEBUG__` shape `{ gameState, gameMode, players: [{id,x,y,z,dead}|null, ...] }`.

Do NOT add a separate vitest config file — the per-file `// @vitest-environment node` pragma overrides the project's jsdom default, and the CLI path `tests/e2e/game.e2e.js` overrides the `include` glob. No edits to `vitest.config.js`.
  </action>
  <verify>
    <automated>npm run test:e2e -- --reporter=dot 2>&1 | tail -n 20; EXIT=${PIPESTATUS[0]}; test $EXIT -eq 0</automated>
  </verify>
  <done>
    - `tests/e2e/game.e2e.js` exists, starts with `// @vitest-environment node`, and uses puppeteer (not jsdom) to launch a real browser.
    - `npm run test:e2e` exits 0: it starts a Vite dev server on port 5174, loads the game, starts a single-player match, and asserts player 1 moves > 1.0 xz-units after keydown KeyD and again after keydown KeyW.
    - `npm test` (the default unit suite) is unchanged in pass/fail count and does not run the e2e file.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process → spawned browser | Puppeteer launches Chromium with `--no-sandbox`; only the e2e test crosses this. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260714-01 | Tampering | `puppeteer` npm install | high | mitigate | `puppeteer` is a well-known Google-maintained package on npmjs.com/package/puppeteer; pin `^23.0.0`. Verify the published package identity before global install / CI adoption. Do not enable `auto_advance` auto-approval blindly for the install. |
| T-260714-02 | Information Disclosure | `window.__DROPFALL_DEBUG__` | low | mitigate | Guarded by `import.meta.env.DEV` → tree-shaken out of production (`vite build`) and Electron/Railway builds; only exposes read-only position/flag, no secrets or internals. |
| T-260714-03 | Elevation of Privilege | headless Chromium args | medium | mitigate | `--no-sandbox` is scoped to the ephemeral test browser only and is the standard puppeteer pattern for CI; the dev server bound to `127.0.0.1` is not exposed externally. |
</threat_model>

<verification>
- `npm run test:e2e` passes (green), proving the full chain: Vite dev server → real browser → WebGL init → game start → physics → observable player movement.
- `npm test` still passes with the same unit-test count (e2e file is outside the default include glob).
- `npm run build` succeeds and the built bundle does NOT contain `__DROPFALL_DEBUG__` (dev guard tree-shaken): `grep -c '__DROPFALL_DEBUG__' dist/assets/*.js || echo 0`.
</verification>

<success_criteria>
- A single command, `npm run test:e2e`, launches Dropfall in a headless browser, starts a single-player game, and verifies keyboard input moves the player — with zero manual server/launch steps.
- The change is non-invasive: production builds exclude the debug hook, and the existing unit-test suite is untouched.
</success_criteria>

<output>
Create `.planning/quick/260714-ohl-add-visual-e2e-interaction-tests-for-the/260714-ohl-SUMMARY.md` when done
</output>
</content>