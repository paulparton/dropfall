// @vitest-environment node
import { describe, it } from 'vitest';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

describe('diag2', () => {
  it('tracks state', async () => {
    const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5176, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE_ERR: ' + m.text()); });
    const gs = () => page.evaluate(() => window.__DROPFALL_DEBUG__?.gameState);
    const ne = () => page.evaluate(() => !document.getElementById('name-entry')?.classList.contains('hidden'));
    const hud = () => page.evaluate(() => !document.getElementById('hud')?.classList.contains('hidden'));
    const menu = () => page.evaluate(() => !document.getElementById('menu')?.classList.contains('hidden'));

    await page.goto('http://localhost:5176/', { waitUntil: 'networkidle0' });
    // Wait for menu visible (init reached showScreen('menu'))
    await page.waitForFunction(() => !document.getElementById('menu')?.classList.contains('hidden'), { timeout: 30000 });
    console.log('STEP1 menu visible, gameState=', await gs());
    // Extra settle time for any post-init async
    await new Promise(r => setTimeout(r, 1500));
    console.log('STEP2 after settle, gameState=', await gs(), 'menu=', await menu());

    await page.click('#mode-single-btn');
    await new Promise(r => setTimeout(r, 500));
    console.log('STEP3 after mode click, gameState=', await gs(), 'name-entry=', await ne());

    await page.waitForFunction(() => !document.getElementById('name-entry')?.classList.contains('hidden'), { timeout: 10000 });
    console.log('STEP4 name-entry visible, gameState=', await gs());

    // Click ready-up and poll
    await page.click('#name-entry-play-btn');
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const s = await gs();
      const h = await hud();
      console.log('STEP5 poll', i, 'gameState=', s, 'hud=', h);
      if (h) break;
    }
    console.log('FINAL errors:', JSON.stringify(errors, null, 2));
    await browser.close();
    await server.close();
  }, 120000);
});
