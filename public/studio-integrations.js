const MEASUREMENT_ID = 'G-HSDS6QM123';
const LAYER_NAME = 'dropfallStudioLayer';
const CONSENT_MAX_AGE_MS = 180 * 86400 * 1000;
const PRODUCTS = Object.freeze({
  'super-face-pop': { host: 'super-face-pop.dropfall-game.com', title: 'Super Face Pop' },
  'big-racers': { host: 'big-racers.dropfall-game.com', title: 'Big Racers' },
  mofighter: { host: 'mofighter.dropfall-game.com', title: 'moFighter' },
});
const MODES = new Set(['solo', 'local', 'online', 'practice', 'arcade', 'unknown']);

export function readStudioConsent(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !['granted', 'denied'].includes(value.choice)) return 'unknown';
    if (!Number.isFinite(value.updatedAt) || value.updatedAt > now || now - value.updatedAt >= CONSENT_MAX_AGE_MS) return 'unknown';
    return value.choice;
  } catch { return 'unknown'; }
}

export function studioProduct(productId, location) {
  const product = PRODUCTS[productId];
  if (!product || location?.protocol !== 'https:' || location.hostname !== product.host || (location.port && location.port !== '443')) return null;
  return {
    productId,
    page_location: `${location.origin}/`,
    page_title: product.title,
    page_referrer: '',
  };
}

export function studioEvent(name, params = {}) {
  if (['page_view', 'game_ready'].includes(name)) return {};
  if (!params || typeof params !== 'object' || Array.isArray(params) || !MODES.has(params.mode)) return null;
  if (['play_start', 'play_complete', 'play_abandon'].includes(name)) return { mode: params.mode };
  return null;
}

function privacyUi({ doc, title, consent, onChoice }) {
  const host = doc.createElement('div');
  host.dataset.dropfallPrivacy = 'true';
  const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  root.innerHTML = `
    <style>
      :host{position:fixed;z-index:2147483000;right:12px;bottom:12px;font:14px/1.45 system-ui,-apple-system,sans-serif;color:#f7fbff}
      button,a{font:inherit}.choice{border:1px solid #57d8ee;background:#071328;color:#fff;border-radius:999px;padding:9px 13px;cursor:pointer;box-shadow:0 6px 24px #0008}
      .panel{position:absolute;right:0;bottom:48px;width:min(360px,calc(100vw - 24px));box-sizing:border-box;padding:18px;background:#071328;color:#f7fbff;border:1px solid #57d8ee;border-radius:14px;box-shadow:0 18px 60px #000c}
      .panel[hidden]{display:none}.panel h2{font-size:18px;margin:0 0 8px}.panel p{margin:8px 0;color:#d5e4ef}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.actions button{border:1px solid #6b7b91;background:#101f38;color:#fff;border-radius:8px;padding:9px 12px;cursor:pointer}.actions .allow{background:#36c7df;color:#03101a;border-color:#36c7df;font-weight:700}.status{font-size:13px;color:#83e7f5!important}a{color:#83e7f5}
    </style>
    <button class="choice" type="button">Privacy choices</button>
    <section class="panel" role="dialog" aria-label="Privacy choices" hidden>
      <h2>Help improve ${title}</h2>
      <p>Optional Google Analytics tells Dropfall Game Studio when the game opens and when a match starts or finishes. We don’t send player names, scores, room codes or searches.</p>
      <p>Google receives technical information such as browser, device and IP connection details. The game works the same if you say no.</p>
      <p class="status" aria-live="polite"></p>
      <p><a href="https://dropfall-game.com/privacy.html" target="_blank" rel="noopener noreferrer">Analytics and storage notice</a></p>
      <div class="actions"><button class="deny" type="button"></button><button class="allow" type="button">Allow analytics</button><button class="done" type="button">Done</button></div>
    </section>`;
  const panel = root.querySelector('.panel');
  const choice = root.querySelector('.choice');
  const status = root.querySelector('.status');
  const deny = root.querySelector('.deny');
  const allow = root.querySelector('.allow');
  const render = next => {
    status.textContent = next === 'granted' ? 'Analytics is on. You can turn it off here at any time.' : 'Analytics is off. Your choice does not affect the game.';
    deny.textContent = next === 'granted' ? 'Disable analytics' : 'No thanks';
    allow.hidden = next === 'granted';
  };
  render(consent);
  choice.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  root.querySelector('.done').addEventListener('click', () => { panel.hidden = true; });
  deny.addEventListener('click', () => { onChoice('denied'); render('denied'); panel.hidden = true; });
  allow.addEventListener('click', () => { onChoice('granted'); render('granted'); panel.hidden = true; });
  doc.body.append(host);
  if (consent === 'unknown') panel.hidden = false;
  return { update: render, destroy: () => host.remove() };
}

export function initStudioIntegration({ productId, win = window, doc = document, now = Date.now } = {}) {
  const page = studioProduct(productId, win.location);
  if (!page || win.navigator?.globalPrivacyControl || win.navigator?.doNotTrack === '1') return null;
  const key = `dropfall:analytics-consent:v1:${productId}`;
  const disableKey = `ga-disable-${MEASUREMENT_ID}`;
  const prefix = `dropfall_${productId.replaceAll('-', '_')}`;
  let consent = 'unknown';
  let loaded = false;
  let failed = false;
  let ready = false;
  let pageSent = false;
  let readySent = false;
  let layer = null;
  let tag = null;
  let script = null;
  try { consent = readStudioConsent(win.localStorage.getItem(key), now()); } catch { /* memory-only */ }
  win[disableKey] = true;

  const clearCookies = () => {
    try {
      for (const part of doc.cookie.split(';')) {
        const name = part.trim().split('=')[0];
        if (name.startsWith(`${prefix}_`)) doc.cookie = `${name}=;Max-Age=0;Path=/;Secure;SameSite=Lax`;
      }
    } catch { /* restricted storage */ }
  };
  const track = (name, params = {}) => {
    const safe = studioEvent(name, params);
    if (!safe || consent !== 'granted' || !loaded || failed || win[disableKey] !== false) return false;
    tag('event', name, { ...safe, ...page, product_id: productId, send_to: MEASUREMENT_ID });
    return true;
  };
  const announce = () => {
    if (!pageSent) pageSent = track('page_view');
    if (ready && !readySent) readySent = track('game_ready');
  };
  const stop = () => {
    win[disableKey] = true;
    loaded = false;
    // A revoked choice during a network load cannot be safely resumed because
    // the tag may have consumed only part of its queued configuration.
    if (script && script.dataset.loaded !== 'true') failed = true;
    if (layer) layer.length = 0;
    clearCookies();
  };
  const start = () => {
    if (consent !== 'granted' || failed) return;
    if (script?.dataset.loaded === 'true') { win[disableKey] = false; loaded = true; announce(); return; }
    if (script) return;
    if (win.gtag || win.dataLayer || win[LAYER_NAME] || [...doc.scripts].some(s => /(?:googletagmanager|google-analytics)\.com\//i.test(s.src))) { failed = true; return; }
    layer = []; win[LAYER_NAME] = layer; tag = function () { layer.push(arguments); };
    tag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    tag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    tag('set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false });
    tag('set', 'url_passthrough', false); tag('set', 'ads_data_redaction', true); tag('js', new Date(now()));
    tag('config', MEASUREMENT_ID, { ...page, product_id: productId, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: 'none', cookie_prefix: prefix, cookie_path: '/', cookie_flags: 'SameSite=Lax;Secure', cookie_expires: 2419200, cookie_update: false });
    script = doc.createElement('script'); script.async = true; script.referrerPolicy = 'no-referrer'; script.dataset.dropfallAnalytics = productId;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}&l=${LAYER_NAME}`;
    script.onload = () => { script.dataset.loaded = 'true'; if (consent === 'granted' && !failed) { win[disableKey] = false; loaded = true; announce(); } else stop(); };
    script.onerror = () => { failed = true; stop(); };
    doc.head.append(script);
  };
  const setConsent = choice => {
    if (!['granted', 'denied'].includes(choice)) return;
    consent = choice;
    try { win.localStorage.setItem(key, JSON.stringify({ version: 1, choice, updatedAt: now() })); } catch { /* memory-only */ }
    if (choice === 'granted') start(); else stop();
    ui.update(choice);
  };
  const ui = privacyUi({ doc, title: page.page_title, consent, onChoice: setConsent });
  if (consent === 'granted') start(); else clearCookies();
  return { markReady() { ready = true; announce(); }, track, setConsent, getConsent: () => consent, destroy() { stop(); ui.destroy(); } };
}
