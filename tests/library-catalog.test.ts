import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { games, launchUrl } from '../src/library/catalog.js';

describe('game library catalogue', () => {
  it('populates the four requested games with usable launch destinations', () => {
    expect(games.map((game) => game.title)).toEqual([
      'Super Face Pop', 'Dropfall', 'Big Racers', 'moFighter',
    ]);
    expect(new Set(games.map((game) => game.id)).size).toBe(4);

    for (const game of games) {
      const destination = launchUrl(game);
      expect(destination, `${game.title} needs a playable destination`).not.toBeNull();
      const resolved = new URL(destination!, 'https://dropfall-game.com/');
      expect(resolved.protocol).toBe('https:');
      expect(resolved.username).toBe('');
      expect(resolved.password).toBe('');
      expect(game.description.length).toBeGreaterThan(30);
      expect(game.controls.length).toBeGreaterThan(20);
      expect(game.modes.length).toBeGreaterThan(0);
      expect(game.imageAlt.length).toBeGreaterThan(15);
      expect(existsSync(resolve(process.cwd(), 'public', game.image.slice(1)))).toBe(true);
    }

    expect(launchUrl(games.find((game) => game.id === 'dropfall'))).toBe('/dropfall-arena/');
  });

  it('labels the two new public previews and describes mobile support truthfully', () => {
    for (const id of ['big-racers', 'mofighter']) {
      const game = games.find((entry) => entry.id === id)!;
      expect(game.status).toBe('preview');
      expect(game.availability).toMatch(/preview/i);
    }
    const fighter = games.find((game) => game.id === 'mofighter')!;
    expect(fighter.platforms).toEqual(['desktop']);
    expect(fighter.controls).toMatch(/does not currently support touch/i);
    expect(games.filter((game) => game.platforms.includes('mobile')).map((game) => game.id))
      .toEqual(['super-face-pop', 'dropfall', 'big-racers']);
  });
});

describe('library launch URL validation', () => {
  it.each(['available', 'preview'])('allows an HTTPS destination for a %s game', (status) => {
    expect(launchUrl({ status, url: 'https://games.example/play?mode=solo#start' }))
      .toBe('https://games.example/play?mode=solo#start');
    expect(launchUrl({ status, url: '/dropfall-arena/?room=ABC123#play' }))
      .toBe('/dropfall-arena/?room=ABC123#play');
  });

  it.each([
    ['development', 'https://games.example/'],
    ['unlisted', 'https://games.example/'],
    ['available', null],
    ['available', ''],
  ])('does not offer a launch for status %s and URL %s', (status, url) => {
    expect(launchUrl({ status, url })).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://games.example/',
    'ftp://games.example/',
    'file:///private/game.html',
    '//games.example/',
    'games.example/play',
    'https://',
    'https://player:password@games.example/',
    'https://player@games.example/',
    'https://:password@games.example/',
    '/\\games.example/',
    '/\n/games.example/',
    '/\t/games.example/',
  ])('rejects unsafe or ambiguous launch destination %j', (url) => {
    expect(launchUrl({ status: 'available', url })).toBeNull();
  });
});
