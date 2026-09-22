import './analytics-consent.css';

let nextConsentId = 0;

/**
 * Consent presentation only. The service owns storage and all measurement.
 * @param {{getConsent: () => string, setConsent: (choice: 'granted'|'denied') => void,
 * subscribeConsent: (listener: () => void) => (() => void), isAvailable: () => boolean}} analytics
 * @param {{productId?: string}} options
 */
export function mountAnalyticsConsent(analytics, { productId = 'dropfall' } = {}) {
  const id = `df-analytics-${++nextConsentId}`;
  const root = document.createElement('div');
  root.className = 'df-analytics-root';
  root.dataset.productId = productId;
  root.innerHTML = `
    <button class="df-analytics-launcher" type="button" aria-haspopup="dialog" aria-controls="${id}-dialog">Privacy choices</button>
    <section class="df-analytics-banner" aria-labelledby="${id}-banner-title" hidden>
      <h2 class="df-analytics-title" id="${id}-banner-title">Help us improve Dropfall?</h2>
      <p class="df-analytics-copy">Allow optional Google Analytics to measure page visits and game use? Google receives technical information, including browser, device and IP connection information. Games work the same if you say no.</p>
      <button class="df-analytics-text-button" type="button" data-consent-action="details">What’s measured &amp; privacy choices</button>
      <div class="df-analytics-actions">
        <button class="df-analytics-choice" type="button" data-consent-action="deny">No thanks</button>
        <button class="df-analytics-choice" type="button" data-consent-action="allow">Allow analytics</button>
      </div>
      <p class="df-analytics-error" role="alert" hidden></p>
    </section>
    <dialog class="df-analytics-dialog" id="${id}-dialog" aria-labelledby="${id}-title" aria-describedby="${id}-summary">
      <div class="df-analytics-dialog-header">
        <h2 class="df-analytics-title" id="${id}-title">Privacy choices</h2>
        <button class="df-analytics-close" type="button" aria-label="Close privacy choices" autofocus>×</button>
      </div>
      <p class="df-analytics-copy" id="${id}-summary">Google Analytics is optional. It helps us understand page visits and game use so we can improve Dropfall. Your choice never restricts access to the games.</p>
      <p class="df-analytics-copy">We do not intentionally send player names, search text or room codes. Google receives technical information, including browser and device details and IP connection information.</p>
      <p class="df-analytics-copy">This measurement is not for advertising personalization. We do not reuse Pelican Drop Studios (PDS) tracking or advertising audiences. These choices cover analytics, not advertising consent.</p>
      <p class="df-analytics-copy">You can refuse now or turn analytics off at any time from Privacy choices. Turning it off stops future optional measurement; it does not erase information already sent.</p>
      <a class="df-analytics-notice" href="/privacy.html" target="_blank" rel="noopener noreferrer">Read the privacy notice <span class="df-analytics-new-tab">(opens in a new tab)</span></a>
      <p class="df-analytics-status" role="status" aria-live="polite"></p>
      <div class="df-analytics-actions">
        <button class="df-analytics-choice" type="button" data-consent-action="deny">No thanks</button>
        <button class="df-analytics-choice" type="button" data-consent-action="allow">Allow analytics</button>
      </div>
      <p class="df-analytics-error" role="alert" hidden></p>
      <button class="df-analytics-text-button df-analytics-done" type="button">Done</button>
    </dialog>`;
  document.body.append(root);

  const banner = root.querySelector('.df-analytics-banner');
  const launcher = root.querySelector('.df-analytics-launcher');
  const dialog = root.querySelector('dialog');
  const status = dialog.querySelector('.df-analytics-status');
  const allow = dialog.querySelector('[data-consent-action="allow"]');
  const deny = dialog.querySelector('[data-consent-action="deny"]');
  let previousFocus = null;
  let destroyed = false;

  function render() {
    if (destroyed) return;
    const consent = analytics.getConsent();
    const available = analytics.isAvailable();
    banner.hidden = !available || consent !== 'unknown';
    // Existing menu/footer controls are preferred over the standalone fallback.
    launcher.hidden = Boolean(document.querySelector('[data-analytics-settings]'));
    allow.hidden = !available || consent === 'granted';
    deny.hidden = consent === 'denied';
    deny.textContent = consent === 'granted' ? 'Disable analytics' : available ? 'No thanks' : 'Keep analytics off';
    status.textContent = !available
      ? 'Analytics is currently off. It cannot be enabled in this environment.'
      : consent === 'granted'
        ? 'Analytics is on. You can turn it off here at any time.'
        : consent === 'denied'
          ? 'Analytics is off. Your choice does not affect access to games.'
          : 'Analytics is off until you choose to allow it.';
  }

  function clearErrors() {
    root.querySelectorAll('.df-analytics-error').forEach((error) => { error.hidden = true; error.textContent = ''; });
  }

  function open() {
    if (destroyed) return;
    render();
    clearErrors();
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
  }

  function choose(choice) {
    // Recheck the service, not just the rendered button, before opting in.
    if (choice === 'granted' && !analytics.isAvailable()) { render(); return; }
    clearErrors();
    try {
      analytics.setConsent(choice);
      render();
      if (dialog.open) dialog.close();
    } catch {
      root.querySelectorAll('.df-analytics-error').forEach((error) => {
        error.textContent = 'We couldn’t save that choice. Please try again. You can keep playing.';
        error.hidden = false;
      });
    }
  }

  function onAction(event) {
    const action = event.target.closest('[data-consent-action]')?.dataset.consentAction;
    if (action === 'allow') choose('granted');
    else if (action === 'deny') choose('denied');
    else if (action === 'details') open();
  }

  function onSettings(event) {
    if (!(event.target instanceof Element) || !event.target.closest('[data-analytics-settings]')) return;
    event.preventDefault();
    open();
  }

  function onDialogClick(event) {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }

  function onClose() {
    // Native dialogs restore focus; this also covers browser implementations
    // where a changing menu removed the original focused control.
    if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  const stopGameKeys = (event) => event.stopPropagation();
  const close = () => dialog.close();
  root.addEventListener('click', onAction);
  root.addEventListener('keydown', stopGameKeys);
  root.addEventListener('keyup', stopGameKeys);
  launcher.addEventListener('click', open);
  dialog.querySelector('.df-analytics-close').addEventListener('click', close);
  dialog.querySelector('.df-analytics-done').addEventListener('click', close);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('close', onClose);
  document.addEventListener('click', onSettings);
  // Escape uses native cancel/close behavior and never writes a consent choice.
  const unsubscribe = analytics.subscribeConsent(render);
  render();

  return {
    open,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      document.removeEventListener('click', onSettings);
      if (dialog.open) dialog.close();
      root.remove();
    },
  };
}
