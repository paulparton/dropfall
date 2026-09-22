// Public website tag supplied by the owner and verified in the Dropfall account.
// No ad/publisher SDK or PDS destination belongs in this module.
export const MEASUREMENT_ID = 'G-HSDS6QM123';
export const CONSENT_MAX_AGE_MS = 180 * 86400 * 1000;
const COOKIE_AGE_SECONDS = 28 * 86400;
const LAYER_NAME = 'dropfallAnalyticsLayer';
const PRODUCTS = new Set(['library', 'dropfall']);
const GAMES = new Set(['dropfall', 'super-face-pop', 'big-racers', 'mofighter']);
const MODES = new Set(['solo', 'local', 'online', 'unknown']);
const DENIED = Object.freeze({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
const owners = new WeakMap();

export function readAnalyticsConsent(raw, now = Date.now()) {
  try {
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !['granted', 'denied'].includes(record.choice)) return 'unknown';
    if (!Number.isFinite(record.updatedAt) || record.updatedAt > now || now - record.updatedAt >= CONSENT_MAX_AGE_MS) return 'unknown';
    return record.choice;
  } catch { return 'unknown'; }
}

export function analyticsPage(productId, location) {
  if (!PRODUCTS.has(productId) || location?.protocol !== 'https:') return null;
  if (!['dropfall-game.com', 'www.dropfall-game.com', 'dropfall.dropfall-game.com'].includes(location.hostname)) return null;
  if (location.port && location.port !== '443') return null;
  const path = location.pathname;
  if (productId === 'library' && location.hostname !== 'dropfall.dropfall-game.com' && ['/', '/index.html', '/privacy.html'].includes(path)) {
    return { page_location: `${location.origin}${path === '/privacy.html' ? path : '/'}`, page_title: path === '/privacy.html' ? 'Dropfall — Analytics and storage' : 'Dropfall — Game library', page_referrer: '' };
  }
  if (productId === 'dropfall' && ['/dropfall-arena/', '/dropfall-arena/index.html'].includes(path)) {
    return { page_location: `${location.origin}/dropfall-arena/`, page_title: 'Dropfall Arena', page_referrer: '' };
  }
  return null;
}

// Build fresh payloads from bounded enums. Never spread caller data into gtag.
export function analyticsEvent(productId, name, params = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  let game_id, saved, placement, mode, outcome;
  try { ({ game_id, saved, placement, mode, outcome } = params); } catch { return null; }
  if (name === 'page_view' && PRODUCTS.has(productId)) return {};
  if (productId === 'library') {
    if (name === 'library_view') return {};
    if (!GAMES.has(game_id)) return null;
    if (name === 'game_details_view') return { game_id };
    if (name === 'game_saved' && typeof saved === 'boolean') return { game_id, saved };
    if (name === 'game_launch' && ['hero', 'card', 'dialog'].includes(placement)) return { game_id, placement };
  }
  if (productId === 'dropfall') {
    if (name === 'game_ready') return {};
    if (['play_start', 'play_complete', 'play_abandon'].includes(name) && MODES.has(mode)) {
      const result = { mode };
      if (name === 'play_complete' && ['win', 'loss', 'draw', 'complete'].includes(outcome)) result.outcome = outcome;
      return result;
    }
  }
  return null;
}

/**
 * Basic consent mode: no Google request before opt-in, no pre-consent backlog.
 * Dependency injection is for tests; application entry points use the defaults.
 * @param {{productId?: string, enabled?: boolean, win?: Window, doc?: Document, now?: () => number}} options
 */
export function createAnalytics({ productId, enabled = import.meta.env?.VITE_DROPFALL_ANALYTICS_ENABLED === 'true', win = window, doc = document, now = Date.now } = {}) {
  if (owners.has(win)) return owners.get(win);
  const page = analyticsPage(productId, win.location);
  const storageKey = `dropfall:analytics-consent:v1:${productId}`;
  const cookiePrefix = `dropfall_${productId === 'library' ? 'library' : 'arena'}`;
  const disableKey = `ga-disable-${MEASUREMENT_ID}`;
  const listeners = new Set();
  let disposed = false;
  let script = null;
  let tag = null;
  let loaded = false;
  let failed = false;
  let functionalReady = false;
  let readySent = false;
  let pageSent = false;
  let ownLayer = null;
  let storage = null;
  let consentUpdatedAt = now();
  let expiryTimer = null;
  try { storage = win.localStorage; } catch { /* Preferences stay in memory. */ }
  const readStored = () => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(storageKey);
      const choice = readAnalyticsConsent(raw, now());
      if (choice !== 'unknown') consentUpdatedAt = JSON.parse(raw).updatedAt;
      return choice;
    } catch { storage = null; return null; }
  };
  let consent = readStored() || 'unknown';
  const available = enabled === true && Boolean(page) && !win.navigator?.globalPrivacyControl && win.navigator?.doNotTrack !== '1';
  win[disableKey] = true;

  function notify() {
    for (const listener of listeners) { try { listener(consent); } catch { /* Optional UI must not block the game. */ } }
  }

  function clearOwnedCookies() {
    try {
      for (const entry of doc.cookie.split(';')) {
        const name = entry.trim().split('=')[0];
        if (name.startsWith(`${cookiePrefix}_`)) doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
      }
    } catch { /* Storage restrictions already prevent persistence. */ }
  }

  function stop() {
    // Google checks this before setting cookies or sending Analytics events.
    // Do not send denied-mode pings; never load a tag just to communicate refusal.
    win[disableKey] = true;
    win.clearTimeout(expiryTimer);
    expiryTimer = null;
    loaded = false;
    // Revoking during initial loading discards configuration along with queued
    // commands. Never revive that partially initialized runtime on this page.
    if (script && script.dataset.loaded !== 'true') failed = true;
    if (ownLayer) ownLayer.length = 0;
    clearOwnedCookies();
  }

  function track(name, params = {}) {
    if (consent === 'granted' && (now() < consentUpdatedAt || now() - consentUpdatedAt >= CONSENT_MAX_AGE_MS)) applyConsent('unknown', false);
    if (disposed || !available || failed || consent !== 'granted' || !loaded || win[disableKey] !== false) return false;
    const safe = analyticsEvent(productId, name, params);
    if (!safe) return false;
    try {
      tag('event', name, { ...safe, ...page, product_id: productId, send_to: MEASUREMENT_ID });
      return true;
    } catch { stop(); failed = true; return false; }
  }

  function announceReady() {
    if (!pageSent) pageSent = track('page_view');
    if (functionalReady && !readySent) readySent = track(productId === 'library' ? 'library_view' : 'game_ready');
  }

  function hasOtherTag() {
    if (win.gtag || win.dataLayer || (win[LAYER_NAME] && win[LAYER_NAME] !== ownLayer)) return true;
    return [...doc.scripts].some(item => item !== script && /(?:googletagmanager|google-analytics)\.com\//i.test(item.src));
  }

  function start() {
    if (disposed || !available || failed || consent !== 'granted') return;
    scheduleExpiry();
    if (consent !== 'granted') return;
    if (hasOtherTag()) { failed = true; stop(); notify(); return; }
    if (script) {
      // A loaded runtime stays in memory after withdrawal, but is disabled.
      // Reuse it only after a fresh affirmative choice; never append a duplicate.
      if (script.dataset.loaded === 'true') {
        win[disableKey] = false;
        loaded = true;
        announceReady();
      }
      return;
    }
    ownLayer = [];
    win[LAYER_NAME] = ownLayer;
    tag = function () { ownLayer.push(arguments); };
    tag('consent', 'default', { ...DENIED });
    tag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
    tag('set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false });
    tag('set', 'url_passthrough', false);
    tag('set', 'ads_data_redaction', true);
    tag('js', new Date(now()));
    tag('config', MEASUREMENT_ID, {
      ...page, product_id: productId, send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: 'none', cookie_prefix: cookiePrefix, cookie_path: '/',
      cookie_flags: 'SameSite=Lax;Secure', cookie_expires: COOKIE_AGE_SECONDS,
      cookie_update: false,
    });
    win[disableKey] = false;
    script = doc.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.dataset.dropfallAnalytics = productId;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}&l=${LAYER_NAME}`;
    script.onload = () => {
      script.dataset.loaded = 'true';
      if (!disposed && consent === 'granted' && available && !failed) {
        win[disableKey] = false;
        loaded = true;
        announceReady();
      } else stop();
    };
    script.onerror = () => { failed = true; stop(); notify(); };
    try { doc.head.append(script); } catch { failed = true; stop(); }
  }

  function applyConsent(next, persist) {
    if (disposed || !['unknown', 'granted', 'denied'].includes(next)) return;
    if (next === 'granted' && (!available || failed)) return;
    const changed = consent !== next;
    consent = next;
    if (next !== 'granted') stop();
    if (persist) {
      consentUpdatedAt = now();
      try { storage?.setItem(storageKey, JSON.stringify({ version: 1, choice: next, updatedAt: consentUpdatedAt })); } catch { storage = null; /* Memory-only choice is valid for this page. */ }
    }
    if (changed) notify();
    if (next === 'granted') start();
  }

  function scheduleExpiry() {
    win.clearTimeout(expiryTimer);
    const remaining = consentUpdatedAt + CONSENT_MAX_AGE_MS - now();
    if (remaining <= 0 || now() < consentUpdatedAt) { applyConsent('unknown', false); return; }
    // Browser timers overflow beyond ~24 days. Recheck long-lived grants in
    // bounded steps, including when there are no app-generated events.
    expiryTimer = win.setTimeout(() => {
      if (consent !== 'granted' || disposed) return;
      if (now() - consentUpdatedAt >= CONSENT_MAX_AGE_MS || now() < consentUpdatedAt) applyConsent('unknown', false);
      else scheduleExpiry();
    }, Math.min(remaining, 2147483647));
  }

  function onStorage(event) {
    if (event.key !== storageKey && event.key !== null) return;
    const next = event.key === null ? 'unknown' : readAnalyticsConsent(event.newValue, now());
    if (next !== 'unknown') consentUpdatedAt = JSON.parse(event.newValue).updatedAt;
    applyConsent(next, false);
  }
  function refreshConsent() {
    const current = readStored();
    if (current !== null) applyConsent(current, false);
  }
  win.addEventListener('storage', onStorage);
  win.addEventListener('pageshow', refreshConsent);
  doc.addEventListener('visibilitychange', refreshConsent);
  const service = {
    track,
    getConsent: () => consent,
    isAvailable: () => available && !failed && !disposed,
    setConsent: choice => applyConsent(choice, true),
    subscribeConsent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    markReady() { functionalReady = true; announceReady(); },
    destroy() {
      disposed = true;
      stop();
      win.removeEventListener('storage', onStorage);
      win.removeEventListener('pageshow', refreshConsent);
      doc.removeEventListener('visibilitychange', refreshConsent);
      listeners.clear();
      // Retain the per-document owner: a second controller may not re-enable a
      // vendor runtime whose first controller has already been destroyed.
    },
  };
  owners.set(win, service);
  if (consent === 'granted') start(); else clearOwnedCookies();
  return service;
}
