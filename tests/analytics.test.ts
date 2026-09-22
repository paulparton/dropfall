import { describe, expect, it, vi } from 'vitest';
import {
  CONSENT_MAX_AGE_MS,
  MEASUREMENT_ID,
  analyticsEvent,
  analyticsPage,
  createAnalytics,
  readAnalyticsConsent,
} from '../src/services/analytics.js';

const INITIAL_TIME = Date.UTC(2026, 8, 10);
const LIBRARY_KEY = 'dropfall:analytics-consent:v1:library';
const ARENA_KEY = 'dropfall:analytics-consent:v1:dropfall';
const DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;
const choice = (value: string, updatedAt = INITIAL_TIME, version = 1) =>
  JSON.stringify({ version, choice: value, updatedAt });

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

type TestWindow = EventTarget & {
  location: URL;
  navigator: { globalPrivacyControl?: boolean; doNotTrack?: string };
  localStorage: Storage;
  dropfallAnalyticsLayer?: IArguments[];
  [key: string]: unknown;
};

// A detached document cannot fetch the injected vendor script. Tests explicitly
// deliver load/error events, keeping SDK timing and network isolation deterministic.
function harness(url = 'https://dropfall-game.com/', productId = 'library') {
  let time = INITIAL_TIME;
  let nextTimerId = 1;
  const timers = new Map<number, { callback: () => void; due: number; delay: number }>();
  const storage = new MemoryStorage();
  const win = Object.assign(new EventTarget(), {
    location: new URL(url), navigator: {}, localStorage: storage,
    setTimeout: vi.fn((callback: () => void, delay: number) => {
      const id = nextTimerId++;
      timers.set(id, { callback, due: time + delay, delay });
      return id;
    }),
    clearTimeout: vi.fn((id: number) => { timers.delete(id); }),
  }) as unknown as TestWindow;
  const doc = document.implementation.createHTMLDocument('Private dynamic title');
  const cookies = new Map<string, string>();
  const cookieWrites: string[] = [];
  Object.defineProperty(doc, 'cookie', {
    get: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    set: (value: string) => {
      cookieWrites.push(value);
      const [pair = ''] = value.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      if (/Max-Age=0(?:;|$)/i.test(value)) cookies.delete(name);
      else cookies.set(name, pair.slice(separator + 1));
    },
  });
  return {
    win, doc, storage, cookies, cookieWrites,
    create(enabled = true) {
      return createAnalytics({ productId, enabled, win: win as unknown as Window & typeof globalThis, doc, now: () => time });
    },
    setTime(value: number) { time = value; },
    timerDelays: () => [...timers.values()].map((timer) => timer.delay),
    tick(delta: number) {
      const target = time + delta;
      let callbacks = 0;
      while (true) {
        const pending = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
        if (!pending || pending[1].due > target) break;
        if (++callbacks > 100) throw new Error('Unexpected timer loop');
        const [id, timer] = pending;
        timers.delete(id);
        time = timer.due;
        timer.callback();
      }
      time = target;
    },
    scripts: () => [...doc.scripts],
    load() { doc.scripts[0]!.dispatchEvent(new Event('load')); },
    fail() { doc.scripts[0]!.dispatchEvent(new Event('error')); },
    commands: () => (win.dropfallAnalyticsLayer || []).map((args) => Array.from(args)),
    events() { return this.commands().filter((command) => command[0] === 'event'); },
    storageEvent(key: string | null, newValue: string | null) {
      win.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
    },
    show() {
      win.dispatchEvent(new Event('pageshow'));
      doc.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

describe('analytics choice validation', () => {
  it('recognizes only unexpired, versioned choices with finite, nonfuture timestamps', () => {
    expect(readAnalyticsConsent(choice('granted'), INITIAL_TIME)).toBe('granted');
    expect(readAnalyticsConsent(choice('denied'), INITIAL_TIME)).toBe('denied');
    expect(readAnalyticsConsent(choice('granted', INITIAL_TIME - CONSENT_MAX_AGE_MS + 1), INITIAL_TIME)).toBe('granted');
    for (const raw of [
      null, '', 'not json', '{}', 'null', '[]', 'true',
      choice('granted', INITIAL_TIME + 1),
      choice('granted', INITIAL_TIME - CONSENT_MAX_AGE_MS),
      choice('granted', INITIAL_TIME, 2), choice('allow-everything'),
      JSON.stringify({ version: 1, choice: 'granted', updatedAt: String(INITIAL_TIME) }),
      JSON.stringify({ version: 1, choice: 'granted', updatedAt: null }),
    ]) expect(readAnalyticsConsent(raw, INITIAL_TIME)).toBe('unknown');
  });
});

describe('production route and event allowlists', () => {
  it.each([
    ['library', 'https://dropfall-game.com/?email=private#room-code', 'https://dropfall-game.com/'],
    ['library', 'https://www.dropfall-game.com/index.html?private=1', 'https://www.dropfall-game.com/'],
    ['library', 'https://dropfall-game.com/privacy.html#private', 'https://dropfall-game.com/privacy.html'],
    ['dropfall', 'https://dropfall-game.com/dropfall-arena/index.html?room=secret', 'https://dropfall-game.com/dropfall-arena/'],
    ['dropfall', 'https://dropfall.dropfall-game.com/dropfall-arena/#private', 'https://dropfall.dropfall-game.com/dropfall-arena/'],
  ])('canonicalizes %s %s without query/hash/referrer', (product, url, expected) => {
    expect(analyticsPage(product, new URL(url))).toEqual({
      page_location: expected,
      page_title: product === 'dropfall' ? 'Dropfall Arena' : url.includes('privacy.html') ? 'Dropfall — Analytics and storage' : 'Dropfall — Game library',
      page_referrer: '',
    });
  });

  it.each([
    ['library', 'http://dropfall-game.com/'],
    ['library', 'https://localhost/'],
    ['library', 'https://dropfall-game.com:8443/'],
    ['library', 'https://dropfall-game.com.evil.test/'],
    ['library', 'https://big-racers.dropfall-game.com/'],
    ['library', 'https://dropfall.dropfall-game.com/'],
    ['library', 'https://dropfall-game.com/dropfall-arena/'],
    ['library', 'https://dropfall-game.com/admin.html'],
    ['dropfall', 'https://dropfall-game.com/'],
    ['dropfall', 'https://dropfall-game.com/dropfall-arena/editor/'],
    ['dropfall', 'https://dropfall-game.com/dropfall-arena'],
    ['PDS', 'https://dropfall-game.com/'],
  ])('never loads on unsupported product/route %s %s', (product, url) => {
    expect(analyticsPage(product, new URL(url))).toBeNull();
    const h = harness(url, product);
    const service = h.create();
    service.setConsent('granted');
    service.markReady();
    expect(service.isAvailable()).toBe(false);
    expect(h.scripts()).toHaveLength(0);
    expect(h.win.dropfallAnalyticsLayer).toBeUndefined();
  });

  it('constructs only approved event parameters and rejects arbitrary actions/values', () => {
    const privateParams = { email: 'secret@example.test', room: 'SECRET', score: 999, page_location: 'https://evil.test/?private', user_id: 'private-user' };
    expect(analyticsEvent('library', 'page_view', privateParams)).toEqual({});
    expect(analyticsEvent('library', 'game_details_view', { ...privateParams, game_id: 'dropfall' })).toEqual({ game_id: 'dropfall' });
    expect(analyticsEvent('library', 'game_saved', { ...privateParams, game_id: 'mofighter', saved: false })).toEqual({ game_id: 'mofighter', saved: false });
    expect(analyticsEvent('library', 'game_launch', { ...privateParams, game_id: 'super-face-pop', placement: 'dialog' })).toEqual({ game_id: 'super-face-pop', placement: 'dialog' });
    expect(analyticsEvent('dropfall', 'play_complete', { ...privateParams, mode: 'online', outcome: 'win', duration_sec: 123 })).toEqual({ mode: 'online', outcome: 'win' });
    expect(analyticsEvent('dropfall', 'play_start', { mode: 'solo', outcome: 'win' })).toEqual({ mode: 'solo' });
    expect(analyticsEvent('dropfall', 'play_complete', { mode: 'local', outcome: 'private-player-name' })).toEqual({ mode: 'local' });
    for (const [product, name, params] of [
      ['library', 'arbitrary-private-event', {}],
      ['PDS', 'page_view', {}],
      ['library', 'game_launch', { game_id: 'https://evil.test/', placement: 'card' }],
      ['library', 'game_launch', { game_id: 'dropfall', placement: 'private-room-name' }],
      ['library', 'game_saved', { game_id: 'dropfall', saved: 'yes' }],
      ['dropfall', 'play_start', { mode: 'private-mode' }],
      ['dropfall', 'game_launch', { game_id: 'dropfall', placement: 'card' }],
      ['library', 'game_ready', {}],
      ['library', 'library_view', null],
      ['library', 'library_view', []],
    ] as const) expect(analyticsEvent(product, name, params as unknown as Record<string, unknown>)).toBeNull();
  });

  it('snapshots validated parameter values once so getters cannot substitute private text after validation', () => {
    const mode = vi.fn().mockReturnValueOnce('solo').mockReturnValue('PRIVATE PLAYER NAME');
    expect(analyticsEvent('dropfall', 'play_start', { get mode() { return mode(); } })).toEqual({ mode: 'solo' });
    expect(mode).toHaveBeenCalledTimes(1);
    const gameId = vi.fn().mockReturnValueOnce('dropfall').mockReturnValue('https://private.test/?room=SECRET');
    const placement = vi.fn().mockReturnValueOnce('card').mockReturnValue('PRIVATE ROOM');
    expect(analyticsEvent('library', 'game_launch', {
      get game_id() { return gameId(); }, get placement() { return placement(); },
    })).toEqual({ game_id: 'dropfall', placement: 'card' });
    expect(gameId).toHaveBeenCalledTimes(1);
    expect(placement).toHaveBeenCalledTimes(1);
  });

  it('fails closed on throwing caller parameter access instead of breaking the application', () => {
    const params = { get mode(): string { throw new Error('untrusted getter'); } };
    expect(analyticsEvent('dropfall', 'play_start', params)).toBeNull();
    const h = harness('https://dropfall-game.com/dropfall-arena/', 'dropfall');
    const service = h.create();
    service.setConsent('granted');
    h.load();
    expect(service.track('play_start', params)).toBe(false);
    expect(h.events().map((entry) => entry[1])).toEqual(['page_view']);
  });
});

describe('basic opt-in analytics runtime', () => {
  it('makes no vendor request or layer before choice, refusal, or pre-consent actions', () => {
    const h = harness();
    const service = h.create();
    service.markReady();
    expect(service.track('game_launch', { game_id: 'dropfall', placement: 'hero' })).toBe(false);
    service.setConsent('denied');
    h.show();
    expect(service.getConsent()).toBe('denied');
    expect(h.scripts()).toHaveLength(0);
    expect(h.win.dropfallAnalyticsLayer).toBeUndefined();
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(JSON.parse(h.storage.getItem(LIBRARY_KEY)!)).toEqual({ version: 1, choice: 'denied', updatedAt: INITIAL_TIME });
  });

  it('loads exactly one isolated tag after grant and emits readiness only after its load', () => {
    const h = harness('https://dropfall-game.com/?room=PRIVATE#secret');
    const service = h.create();
    service.markReady();
    service.setConsent('granted');
    service.setConsent('granted');
    expect(h.scripts()).toHaveLength(1);
    const script = h.scripts()[0]!;
    const src = new URL(script.src);
    expect(src.origin).toBe('https://www.googletagmanager.com');
    expect(src.pathname).toBe('/gtag/js');
    expect(src.searchParams.get('id')).toBe(MEASUREMENT_ID);
    expect(src.searchParams.get('l')).toBe('dropfallAnalyticsLayer');
    expect(script.async).toBe(true);
    expect(script.referrerPolicy).toBe('no-referrer');
    expect(h.win.gtag).toBeUndefined();
    expect(h.win.dataLayer).toBeUndefined();
    expect(h.events()).toEqual([]);
    expect(service.track('game_launch', { game_id: 'dropfall', placement: 'hero' })).toBe(false);
    h.load();
    h.load();
    service.markReady();
    expect(h.events().map((entry) => entry[1])).toEqual(['page_view', 'library_view']);
    expect(JSON.stringify(h.commands())).not.toContain('PRIVATE');
    expect(service.track('game_launch', { game_id: 'dropfall', placement: 'card', user_id: 'SECRET', page_location: 'https://evil.test/' })).toBe(true);
    const events = h.events();
    expect(events[events.length - 1]).toEqual(['event', 'game_launch', {
      game_id: 'dropfall', placement: 'card', product_id: 'library', send_to: MEASUREMENT_ID,
      page_location: 'https://dropfall-game.com/', page_title: 'Dropfall — Game library', page_referrer: '',
    }]);
  });

  it('configures host-only product cookies and no ads, linker, URL passthrough or auto page view', () => {
    const h = harness('https://dropfall-game.com/dropfall-arena/', 'dropfall');
    const service = h.create();
    service.setConsent('granted');
    const commands = h.commands();
    expect(commands[0]).toEqual(['consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }]);
    expect(commands[1]).toEqual(['consent', 'update', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }]);
    expect(commands).toContainEqual(['set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false }]);
    expect(commands).toContainEqual(['set', 'url_passthrough', false]);
    expect(commands).toContainEqual(['set', 'ads_data_redaction', true]);
    expect(commands.find((entry) => entry[0] === 'config')).toEqual(['config', MEASUREMENT_ID, {
      page_location: 'https://dropfall-game.com/dropfall-arena/', page_title: 'Dropfall Arena', page_referrer: '', product_id: 'dropfall',
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: 'none', cookie_prefix: 'dropfall_arena', cookie_path: '/',
      cookie_flags: 'SameSite=Lax;Secure', cookie_expires: 28 * 86400, cookie_update: false,
    }]);
    h.load();
    expect(h.events().map((entry) => entry[1])).toEqual(['page_view']);
    service.markReady();
    expect(h.events().map((entry) => entry[1])).toEqual(['page_view', 'game_ready']);
  });

  it.each(['error', 'append'])('fails closed after blocked SDK %s without a retry storm', (failure) => {
    const h = harness();
    const service = h.create();
    if (failure === 'append') vi.spyOn(h.doc.head, 'append').mockImplementation(() => { throw new Error('blocked'); });
    service.setConsent('granted');
    if (failure === 'error') h.fail();
    service.markReady();
    service.setConsent('denied');
    service.setConsent('granted');
    if (h.scripts().length) h.load();
    expect(service.isAvailable()).toBe(false);
    expect(service.track('page_view')).toBe(false);
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(h.events()).toEqual([]);
    expect(h.scripts().length).toBeLessThanOrEqual(1);
  });

  it('disables loaded analytics on withdrawal, clears only owned cookies, and safely reuses the loaded tag', () => {
    const h = harness();
    const service = h.create();
    service.markReady();
    service.setConsent('granted');
    h.load();
    h.cookies.set('dropfall_library_ga', 'owned');
    h.cookies.set('dropfall_library_ga_test', 'owned');
    h.cookies.set('dropfall_arena_ga', 'other product');
    h.cookies.set('_ga', 'unrelated');
    h.cookies.set('PDS_analytics', 'unrelated');
    service.setConsent('denied');
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(h.commands()).toEqual([]);
    expect(service.track('library_view')).toBe(false);
    expect([...h.cookies.keys()]).toEqual(['dropfall_arena_ga', '_ga', 'PDS_analytics']);
    expect(h.cookieWrites.every((write) => write.includes('Max-Age=0; Path=/; SameSite=Lax; Secure'))).toBe(true);
    service.setConsent('granted');
    expect(h.scripts()).toHaveLength(1);
    expect(h.events()).toEqual([]); // no readiness duplication or denied-action replay
    expect(service.track('game_details_view', { game_id: 'mofighter' })).toBe(true);
  });

  it('withdrawal before SDK load permanently closes this document even after late load/regrant', () => {
    const h = harness();
    const service = h.create();
    service.markReady();
    service.setConsent('granted');
    service.setConsent('denied');
    expect(h.commands()).toEqual([]);
    service.setConsent('granted');
    h.load();
    h.show();
    service.setConsent('granted');
    expect(service.getConsent()).toBe('denied');
    expect(service.isAvailable()).toBe(false);
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(service.track('page_view')).toBe(false);
    expect(h.events()).toEqual([]);
    expect(h.scripts()).toHaveLength(1);
  });

  it.each(['get-property', 'get-item', 'set-item'])('keeps an in-memory choice through visibility/pageshow when storage fails at %s', (failure) => {
    const h = harness();
    if (failure === 'get-property') Object.defineProperty(h.win, 'localStorage', { get: () => { throw new Error('blocked'); } });
    if (failure === 'get-item') vi.spyOn(h.storage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    if (failure === 'set-item') vi.spyOn(h.storage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const service = h.create();
    service.setConsent('granted');
    h.load();
    h.show();
    expect(service.getConsent()).toBe('granted');
    expect(service.track('library_view')).toBe(true);
    service.setConsent('denied');
    h.show();
    expect(service.getConsent()).toBe('denied');
    expect(service.track('library_view')).toBe(false);
  });

  it('loads a valid remembered grant but never expired, future or malformed choices', () => {
    for (const raw of [choice('granted', INITIAL_TIME - CONSENT_MAX_AGE_MS), choice('granted', INITIAL_TIME + 1), '{bad', choice('all', INITIAL_TIME)]) {
      const h = harness();
      h.storage.setItem(LIBRARY_KEY, raw);
      const service = h.create();
      service.markReady();
      expect(service.getConsent()).toBe('unknown');
      expect(h.scripts()).toHaveLength(0);
    }
    const h = harness();
    h.storage.setItem(LIBRARY_KEY, choice('granted'));
    expect(h.create().getConsent()).toBe('granted');
    expect(h.scripts()).toHaveLength(1);
  });

  it.each(['expiry', 'clock-rollback'])('rechecks consent at the point of tracking after %s', (condition) => {
    const h = harness();
    const service = h.create();
    service.setConsent('granted');
    h.load();
    h.setTime(condition === 'expiry' ? INITIAL_TIME + CONSENT_MAX_AGE_MS : INITIAL_TIME - 1);
    expect(service.track('page_view')).toBe(false);
    expect(service.getConsent()).toBe('unknown');
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(h.events()).toEqual([]);
  });

  it('automatically expires an idle remembered grant at the boundary without tracking or lifecycle events', () => {
    const h = harness();
    h.storage.setItem(LIBRARY_KEY, choice('granted', INITIAL_TIME - CONSENT_MAX_AGE_MS + 1000));
    const service = h.create();
    h.load();
    const listener = vi.fn();
    service.subscribeConsent(listener);
    h.cookies.set('dropfall_library_ga', 'owned');
    expect(h.timerDelays()).toEqual([1000]);
    h.tick(999);
    expect(service.getConsent()).toBe('granted');
    h.tick(1);
    expect(service.getConsent()).toBe('unknown');
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(h.cookies.has('dropfall_library_ga')).toBe(false);
    expect(listener).toHaveBeenCalledWith('unknown');
    expect(h.commands()).toEqual([]);
    expect(h.timerDelays()).toEqual([]);
  });

  it('chunks long consent expiry timers below signed 32-bit overflow and clears them on destroy', () => {
    const h = harness();
    const service = h.create();
    service.setConsent('granted');
    h.load();
    expect(h.timerDelays()).toEqual([2147483647]);
    h.tick(CONSENT_MAX_AGE_MS - 1);
    expect(service.getConsent()).toBe('granted');
    expect(h.timerDelays().every((delay) => delay > 0 && delay <= 2147483647)).toBe(true);
    h.tick(1);
    expect(service.getConsent()).toBe('unknown');
    expect(h.timerDelays()).toEqual([]);
    service.setConsent('granted');
    expect(h.timerDelays()).toHaveLength(1);
    service.destroy();
    expect(h.timerDelays()).toEqual([]);
  });

  it('isolates consent namespaces and responds to relevant cross-tab revocation/clearing', () => {
    const h = harness();
    h.storage.setItem(ARENA_KEY, choice('granted'));
    const service = h.create();
    expect(service.getConsent()).toBe('unknown');
    h.storageEvent(ARENA_KEY, choice('granted'));
    h.storageEvent('PDS:consent', choice('granted'));
    expect(h.scripts()).toHaveLength(0);
    h.storageEvent(LIBRARY_KEY, choice('granted'));
    h.load();
    expect(service.getConsent()).toBe('granted');
    h.storageEvent(LIBRARY_KEY, choice('denied'));
    expect(service.getConsent()).toBe('denied');
    expect(h.win[DISABLE_KEY]).toBe(true);
    h.storageEvent(null, null);
    expect(service.getConsent()).toBe('unknown');
  });

  it.each(['gtag', 'dataLayer', 'custom-layer', 'google-script'])('refuses to share a document with a pre-existing %s', (existing) => {
    const h = harness();
    if (existing === 'gtag') h.win.gtag = vi.fn();
    if (existing === 'dataLayer') h.win.dataLayer = [];
    if (existing === 'custom-layer') h.win.dropfallAnalyticsLayer = [];
    if (existing === 'google-script') {
      const script = h.doc.createElement('script');
      script.src = 'https://www.google-analytics.com/analytics.js';
      h.doc.head.append(script);
    }
    const originalLayer = h.win.dropfallAnalyticsLayer;
    const service = h.create();
    service.setConsent('granted');
    expect(service.isAvailable()).toBe(false);
    expect(h.doc.querySelectorAll('[data-dropfall-analytics]')).toHaveLength(0);
    expect(h.win.dropfallAnalyticsLayer).toBe(originalLayer);
    expect(h.win[DISABLE_KEY]).toBe(true);
  });

  it.each(['disabled', 'GPC', 'DNT'])('does not load with remembered grant when %s applies', (condition) => {
    const h = harness();
    h.storage.setItem(LIBRARY_KEY, choice('granted'));
    if (condition === 'GPC') h.win.navigator.globalPrivacyControl = true;
    if (condition === 'DNT') h.win.navigator.doNotTrack = '1';
    const service = h.create(condition !== 'disabled');
    service.setConsent('granted');
    service.markReady();
    expect(service.isAvailable()).toBe(false);
    expect(service.track('page_view')).toBe(false);
    expect(h.scripts()).toHaveLength(0);
    expect(h.win.dropfallAnalyticsLayer).toBeUndefined();
  });

  it('returns a per-document singleton and does not revive a destroyed owner', () => {
    const h = harness();
    const first = h.create();
    expect(h.create()).toBe(first);
    first.setConsent('granted');
    h.load();
    const listener = vi.fn();
    const unsubscribe = first.subscribeConsent(listener);
    first.setConsent('denied');
    expect(listener).toHaveBeenCalledWith('denied');
    unsubscribe();
    first.setConsent('granted');
    expect(listener).toHaveBeenCalledTimes(1);
    first.destroy();
    first.destroy();
    expect(h.create()).toBe(first);
    first.setConsent('granted');
    h.storageEvent(LIBRARY_KEY, choice('granted'));
    h.show();
    h.load();
    first.markReady();
    expect(first.isAvailable()).toBe(false);
    expect(first.track('page_view')).toBe(false);
    expect(h.win[DISABLE_KEY]).toBe(true);
    expect(h.events()).toEqual([]);
    expect(h.scripts()).toHaveLength(1);
  });
});
