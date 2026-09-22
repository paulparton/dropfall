import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const adsTxt = readFileSync(join(root, 'public', 'ads.txt'), 'utf8');
const publisherId = '7669551026428141';

describe('AdSense site verification', () => {
  it('publishes the exact dedicated publisher record in ads.txt', () => {
    const lines = adsTxt.trim().split('\n');
    expect(lines[0]).toBe('google.com, pub-7669551026428141, DIRECT, f08c47fec0942fa0');
    expect(lines.slice(1)).toEqual([
      'subdomain=dropfall.dropfall-game.com',
      'subdomain=super-face-pop.dropfall-game.com',
      'subdomain=big-racers.dropfall-game.com',
      'subdomain=mofighter.dropfall-game.com',
    ]);
  });

  it('contains exactly one dedicated AdSense account meta tag in the document head', () => {
    const head = indexHtml.match(/<head>[\s\S]*?<\/head>/i)?.[0] ?? '';
    const tags = [...head.matchAll(/<meta\b[^>]*>/gi)]
      .map(([tag]) => tag)
      .filter(tag => /name=["']google-adsense-account["']/i.test(tag));
    expect(tags).toHaveLength(1);
    expect(tags[0]).toBe('<meta name="google-adsense-account" content="ca-pub-7669551026428141" />');
    expect(tags[0]).toContain(`ca-pub-${publisherId}`);
    const scripts = [...head.matchAll(/<script\b[^>]*>/gi)]
      .map(([tag]) => tag)
      .filter(tag => /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i.test(tag));
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('client=ca-pub-7669551026428141');
    expect(scripts[0]).toContain('crossorigin="anonymous"');
  });
});
