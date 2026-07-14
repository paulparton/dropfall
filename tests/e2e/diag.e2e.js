// @vitest-environment node
import { describe, it } from 'vitest';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

describe('diag', () => {
  it('captures console', async () => {
    const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5175, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });
    const page = await browser.newPage();
    page.on('console', m => console.log('[BROWSER console]', m.type(), m.text()));
    page.on('pageerror', e => console.log('[BROWSER pageerror]', e.message));
    page.on('requestfailed', r => console.log('[BROWSER reqfailed]', r.url(), r.failure()?.errorText));
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));
    const menuVisible = await page.evaluate(() => !document.getElementById('menu')?.classList.contains('hidden'));
    const gameState = await page.evaluate(() => window.__DROPFALL_DEBUG__?.gameState);
    const anyError = await page.evaluate(() => (window.__DROPFALL_DEBUG__ ? 'hook_present' : 'no_hook'));
    console.log('DIAG menuVisible=', menuVisible, 'gameState=', gameState, 'hook=', anyError);
    if (menuVisible) {
      await page.click('#mode-single-btn');
      await new Promise(r => setTimeout(r, 1000));
      const neVisible = await page.evaluate(() => !document.getElementById('name-entry')?.classList.contains('hidden'));
      console.log('DIAG name-entry visible=', neVisible);
      await page.click('#name-entry-play-btn');
      await new Promise(r => setTimeout(r, 6000));
      const hudVisible = await page.evaluate(() => !document.getElementById('hud')?.classList.contains('hidden'));
      const dbg = await page.evaluate(() => window.__DROPFALL_DEBUG__);
      console.log('DIAG after ready-up: hud=', hudVisible, 'debug=', JSON.stringify(dbg));
    }
    await browser.close();
    await server.close();
  }, 60000);
});
