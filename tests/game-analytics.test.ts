import { describe, expect, it, vi } from 'vitest';
import { createGameAnalyticsObserver } from '../src/services/gameAnalytics.js';

type Consent = 'unknown' | 'granted' | 'denied';
type Snapshot = { gameState: string; gameMode?: unknown; [key: string]: unknown };

function harness(initialConsent: Consent = 'granted') {
  let consent = initialConsent;
  let accepted = true;
  let state: Snapshot = { gameState: 'MENU', gameMode: '1P' };
  const events: { name: string; params: { mode: string } }[] = [];
  const listeners = new Set<(value: string) => void>();
  const unsubscribe = vi.fn();
  const analytics = {
    getConsent: vi.fn(() => consent),
    track: vi.fn((name: string, params: { mode: string }) => {
      if (consent !== 'granted' || !accepted) return false;
      events.push({ name, params });
      return true;
    }),
    markReady: vi.fn(),
    subscribeConsent: vi.fn((listener: (value: string) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); unsubscribe(); };
    }),
  };
  const observer = createGameAnalyticsObserver({ analytics });
  return {
    analytics, observer, events, unsubscribe,
    grant(value: Consent) {
      consent = value;
      listeners.forEach((listener) => listener(value));
    },
    setAccepted(value: boolean) { accepted = value; },
    update(gameState: string, extra: Partial<Snapshot> = {}) {
      const next = { ...state, ...extra, gameState };
      observer.observe(next, state);
      state = next;
    },
    start(mode: unknown = '1P', eligible = true) {
      observer.beginMatch({ eligible });
      this.update('COUNTDOWN', { gameMode: mode });
      this.update('PLAYING');
    },
  };
}

describe('consent-gated match analytics observer', () => {
  it('marks readiness once without manufacturing an action event', () => {
    const h = harness('unknown');
    h.observer.ready();
    h.observer.ready();
    h.grant('granted');
    expect(h.analytics.markReady).toHaveBeenCalledTimes(1);
    expect(h.events).toEqual([]);
  });

  it.each([['1P', 'solo'], ['2P', 'local'], ['ONLINE', 'online']])(
    'maps %s to the allowlisted %s mode at the actual playable boundary', (input, mode) => {
      const h = harness();
      h.observer.beginMatch();
      h.update('COUNTDOWN', { gameMode: '1P' });
      expect(h.events).toEqual([]);
      h.update('PLAYING', { gameMode: input });
      h.update('GAME_OVER');
      expect(h.events).toEqual([
        { name: 'play_start', params: { mode } },
        { name: 'play_complete', params: { mode } },
      ]);
    },
  );

  it('counts an entire multi-round match once, ignoring per-frame updates', () => {
    const h = harness();
    h.start('2P');
    h.update('PLAYING', { player1Boost: 100 });
    h.update('ROUND_OVER');
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('ROUND_OVER');
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_complete']);
  });

  it('deduplicates online roundOver(matchOver) followed by matchOver and late events', () => {
    const h = harness();
    h.start('ONLINE');
    h.update('GAME_OVER');
    h.update('GAME_OVER', { winner: 'p1' });
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_complete']);
  });

  it('does not synthesize a start or completion when consent is granted mid-match', () => {
    const h = harness('unknown');
    h.start();
    h.grant('granted');
    h.update('PLAYING');
    h.update('ROUND_OVER');
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events).toEqual([]);
    h.start();
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_complete']);
  });

  it('accepts a grant before the first playable moment without tracking countdown time', () => {
    const h = harness('denied');
    h.observer.beginMatch();
    h.update('COUNTDOWN');
    h.grant('granted');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_complete']);
  });

  it('does not resume a partially tracked match after withdrawal and regrant', () => {
    const h = harness();
    h.start();
    h.grant('denied');
    h.grant('granted');
    h.update('ROUND_OVER');
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start']);
    h.start();
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_start', 'play_complete']);
  });

  it('requires current consent at completion even without a consent subscription', () => {
    let consent = 'granted';
    const analytics = { track: vi.fn(() => true), markReady: vi.fn(), getConsent: () => consent };
    const observer = createGameAnalyticsObserver({ analytics });
    observer.beginMatch();
    observer.observe({ gameState: 'PLAYING', gameMode: '1P' }, { gameState: 'COUNTDOWN' });
    consent = 'denied';
    observer.observe({ gameState: 'GAME_OVER' }, { gameState: 'PLAYING' });
    expect(analytics.track).toHaveBeenCalledTimes(1);
  });

  it('does not retry a start rejected while the SDK is unavailable', () => {
    const h = harness();
    h.setAccepted(false);
    h.start();
    h.setAccepted(true);
    h.update('ROUND_OVER');
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events).toEqual([]);
    expect(h.analytics.track).toHaveBeenCalledTimes(1);
  });

  it('discards abandoned matches and accepts a later new match', () => {
    const h = harness();
    h.start();
    h.update('MENU');
    h.update('GAME_OVER');
    h.start('ONLINE');
    h.update('GAME_OVER');
    expect(h.events).toEqual([
      { name: 'play_start', params: { mode: 'solo' } },
      { name: 'play_start', params: { mode: 'online' } },
      { name: 'play_complete', params: { mode: 'online' } },
    ]);
  });

  it('supersedes a match explicitly even when countdown state does not change', () => {
    const h = harness();
    h.observer.beginMatch();
    h.update('COUNTDOWN');
    h.observer.beginMatch({ eligible: false });
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events).toEqual([]);
    h.start();
    h.observer.beginMatch();
    h.update('COUNTDOWN', { gameMode: '2P' });
    h.update('PLAYING');
    h.update('GAME_OVER');
    expect(h.events.map(({ name }) => name)).toEqual(['play_start', 'play_start', 'play_complete']);
    expect(h.events[2]?.params).toEqual({ mode: 'local' });
  });

  it('never tracks editor tests, unarmed transitions, or a countdown that did not finish', () => {
    const h = harness();
    h.update('COUNTDOWN');
    h.update('PLAYING');
    h.update('GAME_OVER');
    h.start('1P', false);
    h.update('GAME_OVER');
    h.observer.beginMatch();
    h.update('COUNTDOWN');
    h.update('GAME_OVER');
    expect(h.events).toEqual([]);
  });

  it('pins the start mode and never leaks free-form state, scores, names, or IDs', () => {
    const h = harness();
    const privateState = {
      p1Name: 'private player name', p1Score: 42, p2Score: 7,
      online: { currentGame: 'secret-room-code', playerId: 'secret-user-id' },
      selectedLevelId: 'private-draft-id',
      selectedLevelData: { name: 'private custom level', author: 'private author' },
    };
    h.observer.beginMatch();
    h.update('COUNTDOWN');
    h.update('PLAYING', { ...privateState, gameMode: 'custom free-form mode' });
    h.update('GAME_OVER', { ...privateState, gameMode: 'ONLINE' });
    expect(h.events).toEqual([
      { name: 'play_start', params: { mode: 'unknown' } },
      { name: 'play_complete', params: { mode: 'unknown' } },
    ]);
  });

  it('fails closed when optional analytics throws without breaking gameplay', () => {
    const h = harness();
    h.analytics.track.mockImplementation(() => { throw new Error('unavailable'); });
    h.analytics.markReady.mockImplementation(() => { throw new Error('unavailable'); });
    expect(() => {
      h.observer.ready();
      h.start();
      h.update('GAME_OVER');
    }).not.toThrow();
    expect(h.events).toEqual([]);
  });

  it('tears down the consent listener once and ignores subsequent lifecycle calls', () => {
    const h = harness();
    h.start();
    h.observer.destroy();
    h.observer.destroy();
    h.observer.ready();
    h.update('GAME_OVER');
    h.start();
    h.update('GAME_OVER');
    h.grant('denied');
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
    expect(h.analytics.markReady).not.toHaveBeenCalled();
    expect(h.events.map(({ name }) => name)).toEqual(['play_start']);
  });
});
