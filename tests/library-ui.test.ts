import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getAllByRole, within } from '@testing-library/dom';
import { games } from '../src/library/catalog.js';

const pageHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const privacyHtml = readFileSync(resolve(process.cwd(), 'public/privacy.html'), 'utf8');
const savedKey = 'dropfall-library:saved:v1';
type AnalyticsService = ReturnType<(typeof import('../src/services/analytics.js'))['createAnalytics']>;
type ConsentUi = ReturnType<(typeof import('../src/components/AnalyticsConsent.js'))['mountAnalyticsConsent']>;
type TagWindow = EventTarget & { location: URL; localStorage: Storage; navigator: Record<string, unknown>; setTimeout: Window['setTimeout']; clearTimeout: Window['clearTimeout']; dropfallAnalyticsLayer?: ArrayLike<unknown>[] };
let mountedAnalytics: AnalyticsService | undefined;
let mountedConsent: ConsentUi | undefined;

function cleanupAnalytics() {
  mountedConsent?.destroy();
  mountedAnalytics?.destroy();
  mountedConsent = undefined;
  mountedAnalytics = undefined;
  document.querySelectorAll('script[data-dropfall-analytics]').forEach(script => script.remove());
}

function stubDialog(dialog: HTMLDialogElement) {
  dialog.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  dialog.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
}

function button(name: string | RegExp): HTMLButtonElement {
  return getByRole(document.body, 'button', { name }) as HTMLButtonElement;
}

function visibleTitles(): string[] {
  return [...document.querySelectorAll('.card-body h3')].map((heading) => heading.textContent || '');
}

function search(value: string): void {
  const input = getByRole(document.body, 'searchbox', { name: 'Search games by title or genre' });
  fireEvent.input(input, { target: { value } });
}

async function mountLibrary({ analyticsEnabled = false } = {}) {
  cleanupAnalytics();
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(pageHtml, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.className = '';
  document.querySelector<HTMLElement>('#games')!.scrollIntoView = vi.fn();
  // jsdom has no modal top layer. Stub only that browser primitive; all page
  // rendering and event handlers below come from the production entry point.
  stubDialog(document.querySelector<HTMLDialogElement>('#game-dialog')!);
  const tagWindow: TagWindow = Object.assign(new EventTarget(), {
    location: new URL('https://dropfall-game.com/?private_query=never-send#private-fragment'),
    localStorage,
    navigator: {},
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  });
  const analyticsModule = await import('../src/services/analytics.js');
  const createAnalytics = analyticsModule.createAnalytics;
  // Use the real consent gate and event sanitizer. Only inject the public
  // origin and enabled flag; jsdom never downloads or executes the vendor tag.
  vi.spyOn(analyticsModule, 'createAnalytics').mockImplementation(options => {
    mountedAnalytics = createAnalytics({ ...options, enabled: analyticsEnabled, win: tagWindow as unknown as typeof window, doc: document });
    return mountedAnalytics;
  });
  const consentModule = await import('../src/components/AnalyticsConsent.js');
  const mountConsent = consentModule.mountAnalyticsConsent;
  vi.spyOn(consentModule, 'mountAnalyticsConsent').mockImplementation((analytics, options) => {
    mountedConsent = mountConsent(analytics, options);
    return mountedConsent;
  });
  await import('../src/library/main.js');
  document.querySelectorAll<HTMLDialogElement>('.df-analytics-dialog').forEach(stubDialog);
  return { analytics: mountedAnalytics!, tagWindow };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  cleanupAnalytics();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.body.className = '';
});

function tagEvents(win: TagWindow): Array<{ name: string; params: Record<string, unknown> }> {
  return (win.dropfallAnalyticsLayer || []).map(command => Array.from(command))
    .filter(command => command[0] === 'event')
    .map(command => ({ name: command[1] as string, params: command[2] as Record<string, unknown> }));
}

function completeTagLoad() {
  const script = document.querySelector<HTMLScriptElement>('script[data-dropfall-analytics="library"]');
  expect(script).not.toBeNull();
  fireEvent.load(script!);
}

describe('library browsing from the real homepage', () => {
  it('renders all four game cards with safe, announced new-tab launches', async () => {
    await mountLibrary();
    expect(visibleTitles()).toEqual(games.map((game) => game.title));
    expect(document.querySelector('#result-count')?.textContent).toBe('4 games');

    const launches = getAllByRole(document.body, 'link', { name: /opens in a new tab/ });
    expect(launches).toHaveLength(5); // Featured Dropfall plus four cards.
    for (const link of launches) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
    for (const game of games) {
      const card = document.querySelector(`[data-details="${game.id}"]`)!.closest('article')!;
      const link = getByRole(card, 'link', { name: `Play ${game.title} (opens in a new tab)` });
      expect(link.getAttribute('href')).toBe(game.url);
    }

    const staticDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
    const fallback = staticDocument.querySelector('noscript')!;
    const fallbackLinks = fallback.querySelectorAll('a');
    expect(fallbackLinks).toHaveLength(4);
    for (const link of fallbackLinks) {
      expect(link.target).toBe('_blank');
      expect(link.relList.contains('noopener')).toBe(true);
      expect(link.relList.contains('noreferrer')).toBe(true);
      expect(link.textContent).toContain('opens in a new tab');
    }
  });

  it('puts every game in the rotating banner with working manual and timed navigation', async () => {
    await mountLibrary();
    const featureTitle = document.querySelector('#feature-art-title');
    const featureLink = document.querySelector<HTMLAnchorElement>('#feature-play')!;
    expect(featureTitle?.textContent).toBe('DROPFALL');
    expect(getAllByRole(document.querySelector('#feature-dots')!, 'button')).toHaveLength(4);

    for (const game of games) {
      fireEvent.click(button(`Show ${game.title}`));
      expect(featureTitle?.textContent).toBe(game.title.toUpperCase());
      expect(featureLink.dataset.analyticsGame).toBe(game.id);
      expect(featureLink.getAttribute('href')).toBe(game.url);
      expect(document.querySelector('#feature-image')?.getAttribute('alt')).toBe(game.imageAlt);
    }

    fireEvent.click(button('Show Dropfall'));
    fireEvent.click(button('Next game'));
    expect(featureTitle?.textContent).toBe('SUPER FACE POP');
    fireEvent.click(button('Previous game'));
    expect(featureTitle?.textContent).toBe('DROPFALL');
    vi.advanceTimersByTime(7000);
    expect(featureTitle?.textContent).toBe('SUPER FACE POP');
    fireEvent.click(button('Pause'));
    vi.advanceTimersByTime(14000);
    expect(featureTitle?.textContent).toBe('SUPER FACE POP');
  });

  it('searches by title or genre without treating entered markup as HTML', async () => {
    await mountLibrary();
    search('  FACE pOp  ');
    expect(visibleTitles()).toEqual(['Super Face Pop']);
    expect(document.querySelector('#result-count')?.textContent).toBe('1 game');
    search('racing');
    expect(visibleTitles()).toEqual(['Big Racers']);
    search('<img src="search-injection" onerror="alert(1)">');
    expect(visibleTitles()).toEqual([]);
    expect(document.querySelector<HTMLDivElement>('#empty-state')?.hidden).toBe(false);
    expect(document.querySelector('img[src="search-injection"]')).toBeNull();
    fireEvent.click(button('Show all games'));
    expect(visibleTitles()).toHaveLength(4);
    expect((getByRole(document.body, 'searchbox') as HTMLInputElement).value).toBe('');
    expect(document.querySelector<HTMLDivElement>('#empty-state')?.hidden).toBe(true);
  });

  it('combines platform and genre filters and clears the full filter state', async () => {
    await mountLibrary();
    fireEvent.click(button('Mobile-friendly'));
    expect(visibleTitles()).toEqual(['Super Face Pop', 'Dropfall', 'Big Racers']);
    expect(button('Mobile-friendly').getAttribute('aria-pressed')).toBe('true');
    expect(button('All games').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button('Fighting'));
    expect(visibleTitles()).toEqual([]);
    expect(button('Fighting').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Desktop'));
    expect(visibleTitles()).toEqual(['moFighter']);
    fireEvent.click(button(/Clear filters/));
    expect(visibleTitles()).toHaveLength(4);
    expect(button('All games').getAttribute('aria-pressed')).toBe('true');
    expect(button('All genres').getAttribute('aria-pressed')).toBe('true');
  });

  it('sorts titles alphabetically and restores the featured order', async () => {
    await mountLibrary();
    const sort = getByRole(document.body, 'combobox', { name: 'Sort by' });
    fireEvent.change(sort, { target: { value: 'name' } });
    expect(visibleTitles()).toEqual(['Big Racers', 'Dropfall', 'moFighter', 'Super Face Pop']);
    fireEvent.change(sort, { target: { value: 'featured' } });
    expect(visibleTitles()).toEqual(games.map((game) => game.title));
  });
});

describe('device-local saved games', () => {
  it('persists a saved pick, restores it on remount, and supports the empty saved view', async () => {
    await mountLibrary();
    const save = button('Save Dropfall');
    save.focus();
    fireEvent.click(save);
    expect(button('Unsave Dropfall').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(button('Unsave Dropfall'));
    expect(JSON.parse(localStorage.getItem(savedKey)!)).toEqual(['dropfall']);
    expect(document.querySelector('#save-toast')?.textContent).toMatch(/Dropfall saved/);

    await mountLibrary();
    expect(button('Saved 1')).toBeDefined();
    fireEvent.click(button('Saved 1'));
    expect(visibleTitles()).toEqual(['Dropfall']);
    const unsave = button('Unsave Dropfall');
    unsave.focus();
    fireEvent.click(unsave);
    expect(visibleTitles()).toEqual([]);
    expect(document.activeElement).toBe(button('Saved 0'));
    expect(document.querySelector('#empty-message')?.textContent).toMatch(/bookmark.*save it here/i);
    expect(JSON.parse(localStorage.getItem(savedKey)!)).toEqual([]);
    fireEvent.click(getByRole(document.body, 'link', { name: 'Games' }));
    expect(visibleTitles()).toHaveLength(4);
    expect(button('Saved 0').getAttribute('aria-pressed')).toBe('false');
  });

  it('ignores stale IDs and recovers from malformed saved data', async () => {
    localStorage.setItem(savedKey, JSON.stringify(['retired-game', 'dropfall', 'dropfall']));
    await mountLibrary();
    expect(button('Saved 1')).toBeDefined();
    fireEvent.click(button('Saved 1'));
    expect(visibleTitles()).toEqual(['Dropfall']);

    localStorage.setItem(savedKey, '{broken JSON');
    await mountLibrary();
    expect(visibleTitles()).toHaveLength(4);
    expect(button('Saved 0')).toBeDefined();
    expect(document.querySelector<HTMLElement>('#storage-note')?.hidden).toBe(false);
  });

  it('keeps session-only picks usable when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    await mountLibrary();
    expect(visibleTitles()).toHaveLength(4);
    fireEvent.click(button('Save Super Face Pop'));
    expect(button('Saved 1')).toBeDefined();
    fireEvent.click(button('Saved 1'));
    expect(visibleTitles()).toEqual(['Super Face Pop']);
    expect(document.querySelector<HTMLElement>('#storage-note')?.hidden).toBe(false);
    expect(document.querySelector('#storage-note')?.textContent).toContain('for this visit');
  });
});

describe('game details', () => {
  it.each(games.map((game) => [game.id, game.title]))('opens %s with real details and a safe launch', async (id, title) => {
    await mountLibrary();
    fireEvent.click(button(`View ${title} details`));
    const dialog = getByRole(document.body, 'dialog', { name: title }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.body.classList.contains('dialog-is-open')).toBe(true);
    const game = games.find((entry) => entry.id === id)!;
    expect(dialog.textContent).toContain(game.controls);
    expect(dialog.textContent).toContain(game.description);
    const play = within(dialog).getByRole('link', { name: `Play ${title} (opens in a new tab)` });
    expect(play.getAttribute('href')).toBe(game.url);
    expect(play.getAttribute('target')).toBe('_blank');
    expect(play.getAttribute('rel')).toBe('noopener noreferrer');
    if (game.status === 'preview') expect(dialog.textContent).toContain('Playable preview');
    if (id === 'mofighter') expect(dialog.textContent).toContain('Combat does not currently support touch controls');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close game details' }));
    expect(dialog.open).toBe(false);
    expect(document.body.classList.contains('dialog-is-open')).toBe(false);
  });
});

describe('library privacy and analytics integration', () => {
  it('provides privacy access while disabled without enabling a tag or blocking browsing', async () => {
    const { analytics, tagWindow } = await mountLibrary();
    expect(analytics.isAvailable()).toBe(false);
    expect(document.querySelector<HTMLElement>('.df-analytics-banner')?.hidden).toBe(true);
    expect(document.querySelector('script[data-dropfall-analytics]')).toBeNull();
    expect(tagEvents(tagWindow)).toEqual([]);
    const notice = getByRole(document.body, 'link', { name: 'Analytics & storage' });
    expect(notice.getAttribute('href')).toBe('/privacy.html');
    fireEvent.click(button('Privacy choices'));
    const choices = getByRole(document.body, 'dialog', { name: 'Privacy choices' });
    expect(within(choices).getByRole('status').textContent).toContain('Analytics is currently off');
    expect(within(choices).queryByRole('button', { name: 'Allow analytics' })).toBeNull();
    expect(within(choices).getByRole('link', { name: /Read the privacy notice/ }).getAttribute('href')).toBe('/privacy.html');
    fireEvent.click(within(choices).getByRole('button', { name: 'Close privacy choices' }));
    search('racing');
    expect(visibleTitles()).toEqual(['Big Racers']);
  });

  it('keeps the served privacy notice script-free and accurately scoped to every product', () => {
    const notice = new DOMParser().parseFromString(privacyHtml, 'text/html');
    expect(notice.querySelector('h1')?.textContent).toBe('Analytics and storage');
    expect(notice.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
    expect(notice.querySelectorAll('script, iframe, img')).toHaveLength(0);
    expect(notice.querySelector<HTMLAnchorElement>('a.back')?.getAttribute('href')).toBe('/');
    const copy = notice.body.textContent || '';
    expect(copy).toContain('Dropfall Arena, Super Face Pop, Big Racers and moFighter');
    expect(copy).toContain('allowing analytics in one does not opt you in elsewhere');
    expect(copy).toContain('Every product has a separate choice');
    expect(copy).toContain('Global Privacy Control or Do Not Track');
    expect(copy).toContain('180 days');
    expect(copy).toContain('28-day lifetime');
    expect(copy).toContain('not anonymous measurement');
    expect(copy).toContain('not advertising consent');
    expect(copy).toContain('not a promise that the site makes no other network requests');
    expect(notice.querySelector('a[href="https://policies.google.com/privacy"]')).not.toBeNull();
  });

  it('sends nothing before an explicit allow choice and does not replay earlier browsing actions', async () => {
    const { analytics, tagWindow } = await mountLibrary({ analyticsEnabled: true });
    expect(analytics.getConsent()).toBe('unknown');
    expect(document.querySelector<HTMLElement>('.df-analytics-banner')?.hidden).toBe(false);
    fireEvent.click(button('Save Super Face Pop'));
    fireEvent.click(button('View Big Racers details'));
    fireEvent.click(button('Close game details'));
    search('private player name and room code');
    fireEvent.click(button('Show all games'));
    fireEvent.click(document.querySelector('#feature-play')!);
    expect(document.querySelector('script[data-dropfall-analytics]')).toBeNull();
    expect(tagEvents(tagWindow)).toEqual([]);

    fireEvent.click(within(document.querySelector('.df-analytics-banner')!).getByRole('button', { name: 'Allow analytics' }));
    expect(analytics.getConsent()).toBe('granted');
    completeTagLoad();
    expect(tagEvents(tagWindow).map(event => event.name)).toEqual(['page_view', 'library_view']);
    const payload = JSON.stringify(tagEvents(tagWindow));
    expect(payload).not.toMatch(/private_query|private-fragment|private player name|room code/);
    expect(tagEvents(tagWindow).every(event => event.params.page_location === 'https://dropfall-game.com/')).toBe(true);
    expect(tagEvents(tagWindow).every(event => event.params.page_referrer === '')).toBe(true);
  });

  it('tracks exact fixed detail/save/launch events without changing safe new-tab links', async () => {
    const { analytics, tagWindow } = await mountLibrary({ analyticsEnabled: true });
    analytics.setConsent('granted');
    completeTagLoad();
    fireEvent.click(button('Save Super Face Pop'));
    fireEvent.click(button('Unsave Super Face Pop'));
    fireEvent.click(button('View Super Face Pop details'));
    const details = getByRole(document.body, 'dialog', { name: 'Super Face Pop' });
    const dialogLaunch = within(details).getByRole('link', { name: 'Play Super Face Pop (opens in a new tab)' });
    const cardLaunch = document.querySelector<HTMLAnchorElement>('.face-pop .card-play')!;
    const heroLaunch = document.querySelector<HTMLAnchorElement>('#feature-play')!;
    for (const link of [dialogLaunch, cardLaunch, heroLaunch]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      expect(link.getAttribute('href')).toMatch(/^(?:https:\/\/|\/dropfall-arena\/)/);
    }
    fireEvent.click(dialogLaunch.querySelector('span')!);
    fireEvent.click(within(details).getByRole('button', { name: 'Close game details' }));
    fireEvent.click(cardLaunch);
    fireEvent.click(heroLaunch.querySelector('span')!);
    fireEvent(cardLaunch, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    fireEvent(cardLaunch, new MouseEvent('auxclick', { bubbles: true, button: 2 }));

    const events = tagEvents(tagWindow).slice(2);
    expect(events.map(({ name, params }) => ({
      name,
      game_id: params.game_id,
      ...(params.saved === undefined ? {} : { saved: params.saved }),
      ...(params.placement === undefined ? {} : { placement: params.placement }),
    }))).toEqual([
      { name: 'game_saved', game_id: 'super-face-pop', saved: true },
      { name: 'game_saved', game_id: 'super-face-pop', saved: false },
      { name: 'game_details_view', game_id: 'super-face-pop' },
      { name: 'game_launch', game_id: 'super-face-pop', placement: 'dialog' },
      { name: 'game_launch', game_id: 'super-face-pop', placement: 'card' },
      { name: 'game_launch', game_id: 'dropfall', placement: 'hero' },
      { name: 'game_launch', game_id: 'super-face-pop', placement: 'card' },
    ]);
    for (const event of events) {
      expect(Object.keys(event.params).sort()).toEqual([
        'game_id', 'page_location', 'page_referrer', 'page_title', 'product_id', 'send_to',
        ...(event.name === 'game_saved' ? ['saved'] : []),
        ...(event.name === 'game_launch' ? ['placement'] : []),
      ].sort());
      expect(event.params.product_id).toBe('library');
    }
    const count = tagEvents(tagWindow).length;
    search('private search text');
    fireEvent.click(button('Show all games'));
    fireEvent.click(button('Mobile-friendly'));
    fireEvent.change(getByRole(document.body, 'combobox', { name: 'Sort by' }), { target: { value: 'name' } });
    expect(tagEvents(tagWindow)).toHaveLength(count);
  });

  it('stops optional events immediately when consent is withdrawn through the footer', async () => {
    const { analytics, tagWindow } = await mountLibrary({ analyticsEnabled: true });
    analytics.setConsent('granted');
    completeTagLoad();
    fireEvent.click(button('Privacy choices'));
    const choices = getByRole(document.body, 'dialog', { name: 'Privacy choices' });
    fireEvent.click(within(choices).getByRole('button', { name: 'Disable analytics' }));
    expect(analytics.getConsent()).toBe('denied');
    expect(tagEvents(tagWindow)).toEqual([]); // Withdrawal also clears queued commands.
    fireEvent.click(button('Save Dropfall'));
    fireEvent.click(button('View moFighter details'));
    fireEvent.click(button('Close game details'));
    fireEvent.click(document.querySelector('#feature-play')!);
    expect(tagEvents(tagWindow)).toEqual([]);
    expect(button('Unsave Dropfall')).toBeDefined();
    expect(document.querySelector<HTMLElement>('.df-analytics-banner')?.hidden).toBe(true);
  });
});
