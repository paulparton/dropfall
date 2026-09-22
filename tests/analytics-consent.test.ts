import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, queryByRole, within } from '@testing-library/dom';
import { mountAnalyticsConsent } from '../src/components/AnalyticsConsent.js';

type Consent = 'unknown' | 'granted' | 'denied';
let mounted: ReturnType<typeof mountAnalyticsConsent> | undefined;

function service(initial: Consent = 'unknown', enabled = true) {
  let consent = initial;
  let available = enabled;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getConsent: () => consent,
    isAvailable: () => available,
    setConsent: vi.fn((choice: 'granted' | 'denied') => { consent = choice; notify(); }),
    subscribeConsent: vi.fn((listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); }),
    update(choice: Consent) { consent = choice; notify(); },
    setAvailable(value: boolean) { available = value; notify(); },
    listenerCount: () => listeners.size,
  };
}

function mount(analytics = service()) {
  mounted = mountAnalyticsConsent(analytics, { productId: 'library' });
  // Stub only unsupported native primitives; exercise the real component.
  dialog().showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
    this.querySelector<HTMLElement>('[autofocus]')?.focus();
  });
  dialog().close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  });
  return analytics;
}

function banner() { return document.querySelector<HTMLElement>('.df-analytics-banner')!; }
function dialog() { return document.querySelector<HTMLDialogElement>('.df-analytics-dialog')!; }

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

afterEach(() => {
  mounted?.destroy();
  mounted = undefined;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('optional analytics banner', () => {
  it('shows equal-weight choices only for unknown consent without blocking or opting in', () => {
    const analytics = mount();
    expect(banner().hidden).toBe(false);
    expect(dialog().open).toBe(false);
    const allow = within(banner()).getByRole('button', { name: 'Allow analytics' });
    const deny = within(banner()).getByRole('button', { name: 'No thanks' });
    expect(allow.className).toBe(deny.className);
    expect(analytics.setConsent).not.toHaveBeenCalled();
    expect(document.querySelector('script')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it.each(['granted', 'denied'] as const)('does not prompt again with %s consent', (consent) => {
    mount(service(consent));
    expect(banner().hidden).toBe(true);
    expect(queryByRole(document.body, 'button', { name: 'Privacy choices' })).not.toBeNull();
  });

  it.each([['Allow analytics', 'granted'], ['No thanks', 'denied']] as const)('records an explicit %s choice and dismisses the banner', (label, consent) => {
    const analytics = mount();
    fireEvent.click(within(banner()).getByRole('button', { name: label }));
    expect(analytics.setConsent).toHaveBeenCalledExactlyOnceWith(consent);
    expect(banner().hidden).toBe(true);
    expect(dialog().open).toBe(false);
  });

  it('updates from service notifications without writing a choice', () => {
    const analytics = mount();
    analytics.update('denied');
    expect(banner().hidden).toBe(true);
    analytics.update('unknown');
    expect(banner().hidden).toBe(false);
    analytics.setAvailable(false);
    expect(banner().hidden).toBe(true);
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('keeps the game available and reports a failed consent write without pretending success', () => {
    const analytics = mount();
    analytics.setConsent.mockImplementation(() => { throw new Error('storage failure'); });
    fireEvent.click(within(banner()).getByRole('button', { name: 'Allow analytics' }));
    expect(banner().hidden).toBe(false);
    expect(within(banner()).getByRole('alert').textContent).toContain('You can keep playing');
    expect(analytics.getConsent()).toBe('unknown');
  });
});

describe('privacy choices dialog', () => {
  it('explains measurement truthfully and links to the first-party notice', () => {
    const analytics = mount();
    fireEvent.click(within(banner()).getByRole('button', { name: /What’s measured/ }));
    expect(getByRole(document.body, 'dialog', { name: 'Privacy choices' })).toBe(dialog());
    expect(dialog().textContent).toContain('Google Analytics is optional');
    expect(dialog().textContent).toContain('player names, search text or room codes');
    expect(dialog().textContent).toContain('IP connection information');
    expect(dialog().textContent).toContain('not for advertising personalization');
    expect(dialog().textContent).toContain('do not reuse Pelican Drop Studios');
    expect(dialog().textContent).toContain('not advertising consent');
    expect(dialog().textContent).not.toMatch(/anonymous|no data collected/i);
    const notice = within(dialog()).getByRole('link', { name: /Read the privacy notice/ });
    expect(notice.getAttribute('href')).toBe('/privacy.html');
    expect(notice.getAttribute('rel')).toBe('noopener noreferrer');
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('supports disabling previously granted consent and re-enabling by explicit choice', () => {
    const analytics = mount(service('granted'));
    mounted!.open();
    expect(queryByRole(dialog(), 'button', { name: 'Allow analytics' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Disable analytics' }));
    expect(analytics.getConsent()).toBe('denied');
    expect(dialog().open).toBe(false);
    mounted!.open();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Allow analytics' }));
    expect(analytics.getConsent()).toBe('granted');
    expect(dialog().open).toBe(false);
  });

  it.each(['unknown', 'granted', 'denied'] as const)('cannot enable unavailable analytics with %s saved consent', (consent) => {
    const analytics = mount(service(consent, false));
    expect(banner().hidden).toBe(true);
    mounted!.open();
    expect(within(dialog()).getByRole('status').textContent).toContain('Analytics is currently off');
    expect(queryByRole(dialog(), 'button', { name: 'Allow analytics' })).toBeNull();
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('rechecks availability even when an old allow button is programmatically clicked', () => {
    const analytics = mount();
    mounted!.open();
    const allow = within(dialog()).getByRole('button', { name: 'Allow analytics' });
    analytics.setAvailable(false);
    fireEvent.click(allow);
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('wires existing and later-added settings controls while preferring the existing control', () => {
    document.body.innerHTML = '<button data-analytics-settings>Privacy choices</button>';
    const trigger = getByRole(document.body, 'button', { name: 'Privacy choices' });
    const analytics = mount(service('denied'));
    expect(document.querySelector<HTMLButtonElement>('.df-analytics-launcher')!.hidden).toBe(true);
    trigger.focus();
    fireEvent.click(trigger);
    expect(dialog().open).toBe(true);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close privacy choices' }));
    expect(document.activeElement).toBe(trigger);
    document.body.insertAdjacentHTML('beforeend', '<a href="#settings" data-analytics-settings>Menu privacy</a>');
    fireEvent.click(getByRole(document.body, 'link', { name: 'Menu privacy' }));
    expect(dialog().open).toBe(true);
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('allows native Escape dismissal without interpreting it as consent', () => {
    const analytics = mount();
    mounted!.open();
    const cancel = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(false);
    dialog().close(); // Native default action, absent from jsdom.
    expect(analytics.setConsent).not.toHaveBeenCalled();
    expect(banner().hidden).toBe(false);
  });

  it('closes on the backdrop, not interior clicks, without changing consent', () => {
    const analytics = mount();
    mounted!.open();
    vi.spyOn(dialog(), 'getBoundingClientRect').mockReturnValue({ left: 100, right: 400, top: 100, bottom: 500 } as DOMRect);
    fireEvent.click(dialog(), { clientX: 200, clientY: 200 });
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog(), { clientX: 20, clientY: 20 });
    expect(dialog().open).toBe(false);
    expect(analytics.setConsent).not.toHaveBeenCalled();
  });

  it('does not leak button keyboard activation into gameplay listeners', () => {
    mount();
    const gameKey = vi.fn();
    document.addEventListener('keydown', gameKey);
    const allow = within(banner()).getByRole('button', { name: 'Allow analytics' });
    fireEvent.keyDown(allow, { key: 'Enter' });
    document.removeEventListener('keydown', gameKey);
    expect(gameKey).not.toHaveBeenCalled();
  });

  it('cleans up subscriptions, generated controls and document handlers', () => {
    document.body.innerHTML = '<button data-analytics-settings>Privacy choices</button>';
    const trigger = getByRole(document.body, 'button', { name: 'Privacy choices' });
    const analytics = mount();
    expect(analytics.listenerCount()).toBe(1);
    mounted!.destroy();
    mounted!.destroy();
    expect(analytics.listenerCount()).toBe(0);
    expect(document.querySelector('.df-analytics-root')).toBeNull();
    fireEvent.click(trigger);
    analytics.update('granted');
    mounted!.open();
    expect(document.querySelector('.df-analytics-dialog')).toBeNull();
  });
});
