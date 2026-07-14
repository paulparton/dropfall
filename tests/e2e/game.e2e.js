// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

describe('Dropfall e2e', () => {
    let browser;
    let server;
    let page;

    beforeAll(async () => {
        server = await createServer({
            root: process.cwd(),
            logLevel: 'error',
            server: { port: 5174, strictPort: true, host: '127.0.0.1' },
        });
        await server.listen();

        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-webgl',
            ],
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        page.setDefaultTimeout(20000);
    }, 60000);

    afterAll(async () => {
        await browser?.close();
        await server?.close();
    });

    it('starts a game and moves the player', async () => {
        // 1. Navigate to the game. networkidle0 ensures the initial bundle has
        //    finished loading and no open requests remain.
        await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });

        // 2. init() ends with showScreen('menu') which removes `hidden` from #menu.
        //    If this times out, WebGL/init failed and the test correctly fails.
        await page.waitForFunction(
            () => !document.getElementById('menu')?.classList.contains('hidden'),
            { timeout: 20000 },
        );

        // 3. Start single player. setGameMode('1P') -> gameState NAME_ENTRY.
        await page.click('#mode-single-btn');

        // 4. Wait for name-entry screen to be visible.
        await page.waitForFunction(
            () => !document.getElementById('name-entry')?.classList.contains('hidden'),
        );

        // 5. Tap "READY UP". proceedFromNameEntry() loads an optional level then
        //    startGame() -> resetEntities() -> COUNTDOWN -> PLAYING. Level-load
        //    failures are caught internally and fall back to the default arena.
        await page.click('#name-entry-play-btn');

        // 6. HUD becomes visible only once gameState === 'PLAYING' (after the
        //    3-2-1 countdown completes via setPlaying()).
        await page.waitForFunction(
            () => !document.getElementById('hud')?.classList.contains('hidden'),
            { timeout: 25000 },
        );

        // 7. The HUD also hosts the countdown, so visibility begins before
        //    input is unlocked. Wait for PLAYING and valid spawned players.
        await page.waitForFunction(
            () => {
                const d = window.__DROPFALL_DEBUG__;
                return (
                    d &&
                    d.gameState === 'PLAYING' &&
                    d.players &&
                    d.players[0] &&
                    d.players[1] &&
                    !d.players[0].dead &&
                    !d.players[1].dead &&
                    Number.isFinite(d.players[0].x)
                );
            },
            { timeout: 20000, polling: 100 },
        );

        // 8. Record player 1 starting position on the xz plane.
        const start = await page.evaluate(() => {
            const p = window.__DROPFALL_DEBUG__.players[0];
            return { x: p.x, z: p.z };
        });

        // 9. Move player 1 to the right by dispatching the exact KeyboardEvent
        //    the game listens for on window in src/input.js (keys[e.code]).
        //    Synthesize with code:'KeyD' to avoid Puppeteer key-name mapping.
        await page.evaluate(() =>
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true })),
        );
        await page.waitForFunction(
            ({ x, z }) => {
                const p = window.__DROPFALL_DEBUG__?.players?.[0];
                return p && Math.hypot(p.x - x, p.z - z) > 1;
            },
            { timeout: 12000, polling: 100 },
            start,
        );
        await page.evaluate(() =>
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true })),
        );
        await new Promise((r) => setTimeout(r, 250));

        // 10. Read the new position and assert observable xz displacement.
        //     The wait is displacement-based rather than wall-clock-based so the
        //     assertion stays reliable under software-rendered CI frame rates.
        const after = await page.evaluate(() => {
            const p = window.__DROPFALL_DEBUG__.players[0];
            return { x: p.x, z: p.z };
        });
        const moved = Math.hypot(after.x - start.x, after.z - start.z);
        expect(moved).toBeGreaterThan(1.0);

        // 11. Second-direction sanity check: move forward (KeyW) and assert
        //     further xz movement beyond the first reading.
        const start2 = after;
        await page.evaluate(() =>
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })),
        );
        await page.waitForFunction(
            ({ x, z }) => {
                const p = window.__DROPFALL_DEBUG__?.players?.[0];
                return p && Math.hypot(p.x - x, p.z - z) > 1;
            },
            { timeout: 12000, polling: 100 },
            start2,
        );
        await page.evaluate(() =>
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })),
        );
        await new Promise((r) => setTimeout(r, 250));
        const after2 = await page.evaluate(() => {
            const p = window.__DROPFALL_DEBUG__.players[0];
            return { x: p.x, z: p.z };
        });
        const moved2 = Math.hypot(after2.x - start2.x, after2.z - start2.z);
        expect(moved2).toBeGreaterThan(1.0);

        // 12. Offline pause must freeze the simulation and Escape must resume it.
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.__DROPFALL_DEBUG__?.isPaused === true);
        const pausedAt = await page.evaluate(() => {
            const p = window.__DROPFALL_DEBUG__.players[0];
            return { x: p.x, y: p.y, z: p.z };
        });
        await new Promise((r) => setTimeout(r, 500));
        const stillPausedAt = await page.evaluate(() => {
            const p = window.__DROPFALL_DEBUG__.players[0];
            return { x: p.x, y: p.y, z: p.z };
        });
        expect(stillPausedAt).toEqual(pausedAt);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.__DROPFALL_DEBUG__?.isPaused === false);
    }, 90000);
});
