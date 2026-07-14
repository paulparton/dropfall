// @vitest-environment node
import { describe, it } from 'vitest';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

describe('diag3', () => {
  it('tracks clicks', async () => {
    const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5177, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });
    const page = await browser.newPage();
    const logs = [];
    page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => logs.push(`[PAGEERR] ${e.message}`));

    await page.goto('http://localhost:5177/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !document.getElementById('menu')?.classList.contains('hidden'), { timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#mode-single-btn');
    await page.waitForFunction(() => !document.getElementById('name-entry')?.classList.contains('hidden'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    // Check button geometry / visibility
    const geom = await page.evaluate(() => {
      const b = document.getElementById('name-entry-play-btn');
      if (!b) return { exists: false };
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      const mount = document.getElementById('character-preview-mount');
      const entryScreen = document.getElementById('name-entry');
      const entryRect = entryScreen.getBoundingClientRect();
      return {
        exists: true,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        disabled: b.disabled,
        pointerEvents: cs.pointerEvents,
        visibility: cs.visibility,
        display: cs.display,
        entryHeight: entryRect.height,
        entryScrollHeight: entryScreen.scrollHeight,
        entryOverflow: getComputedStyle(entryScreen).overflow,
        mountHeight: mount ? mount.getBoundingClientRect().height : null,
      };
    });
    console.log('BUTTON_GEOM=', JSON.stringify(geom));

    // Try direct element.click() (bypasses hit-testing)
    await page.evaluate(() => document.getElementById('name-entry-play-btn').click());
    await new Promise(r => setTimeout(r, 2000));
    const gs1 = await page.evaluate(() => window.__DROPFALL_DEBUG__?.gameState);
    console.log('AFTER element.click gameState=', gs1);

    await new Promise(r => setTimeout(r, 3000));
    const gs2 = await page.evaluate(() => window.__DROPFALL_DEBUG__?.gameState);
    console.log('AFTER 5s gameState=', gs2);

    console.log('LOGS:', logs.filter(l => l.includes('Proceed') || l.includes('[Click]') || l.includes('PAGEERR') || l.includes('Single')).join('\n  '));
    await browser.close();
    await server.close();
  }, 120000);
});
