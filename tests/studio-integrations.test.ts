// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readStudioConsent, studioEvent, studioProduct } from '../public/studio-integrations.js';

describe('shared studio integration', () => {
  it('allows only exact production game hosts', () => {
    expect(studioProduct('mofighter', new URL('https://mofighter.dropfall-game.com/'))?.productId).toBe('mofighter');
    expect(studioProduct('big-racers', new URL('https://mofighter.dropfall-game.com/'))).toBeNull();
    expect(studioProduct('super-face-pop', new URL('http://super-face-pop.dropfall-game.com/'))).toBeNull();
  });
  it('expires consent and rejects malformed records', () => {
    const now = 200 * 86400 * 1000;
    expect(readStudioConsent(JSON.stringify({ version: 1, choice: 'granted', updatedAt: now - 1000 }), now)).toBe('granted');
    expect(readStudioConsent(JSON.stringify({ version: 1, choice: 'granted', updatedAt: 0 }), now)).toBe('unknown');
    expect(readStudioConsent('nope', now)).toBe('unknown');
  });
  it('uses a bounded event vocabulary', () => {
    expect(studioEvent('play_start', { mode: 'arcade', score: 999 })).toEqual({ mode: 'arcade' });
    expect(studioEvent('play_complete', { mode: 'local', name: 'player' })).toEqual({ mode: 'local' });
    expect(studioEvent('custom', {})).toBeNull();
  });
});
