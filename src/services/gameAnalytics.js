/**
 * Match-level analytics only. This adapter never reads player/profile/room data,
 * persists identifiers, schedules work, or measures time from the render loop.
 *
 * Call beginMatch() immediately before a committed new match's startGame(), not
 * for startRound(). Then observe every store update, including while in VR.
 * COUNTDOWN -> PLAYING is the first playable moment; ROUND_OVER is not a match
 * completion. Explicit arming also distinguishes restarts during COUNTDOWN.
 */

/** @param {unknown} mode */
function safeMode(mode) {
  switch (mode) {
    case '1P': return 'solo';
    case '2P': return 'local';
    case 'ONLINE': return 'online';
    default: return 'unknown';
  }
}

/**
 * @typedef {{gameState?: string, gameMode?: unknown}} GameSnapshot
 * @typedef {{
 *   track: (name: string, params: {mode: string}) => boolean,
 *   markReady: () => void,
 *   getConsent: () => string,
 *   subscribeConsent?: (listener: (consent: string) => void) => (() => void)
 * }} AnalyticsClient
 */

/**
 * A match contributes a completion only when its actual start was accepted by
 * the consent-gated client. Granting consent mid-match never retries that start.
 * Withdrawal permanently disqualifies the current match, even after regrant.
 * No duration is emitted: paused/hidden time is not available in store updates.
 *
 * @param {{analytics: AnalyticsClient}} options
 */
export function createGameAnalyticsObserver({ analytics }) {
  let destroyed = false;
  let readyMarked = false;
  /** @type {{started: boolean, isTrackingAllowed: boolean, mode: string} | null} */
  let match = null;
  let unsubscribeConsent = null;

  function consentGranted() {
    try {
      return analytics.getConsent() === 'granted';
    } catch {
      return false;
    }
  }

  function track(name, mode) {
    if (!consentGranted()) return false;
    try {
      // Construct the payload, never copy arbitrary fields from the store.
      return analytics.track(name, { mode }) === true;
    } catch {
      // Optional measurement must never interrupt gameplay.
      return false;
    }
  }

  try {
    unsubscribeConsent = analytics.subscribeConsent?.((consent) => {
      if (consent !== 'granted' && match) match.isTrackingAllowed = false;
    }) || null;
  } catch {
    // getConsent()/track() still fail closed if the client is unavailable.
  }

  return {
    /**
     * Discard superseded matches without claiming a completion. Pass false for
     * editor playtests; these must not be counted as ordinary player matches.
     * @param {{eligible?: boolean}} [options]
     */
    beginMatch({ eligible = true } = {}) {
      if (destroyed) return;
      match = eligible === true
        ? { started: false, isTrackingAllowed: false, mode: 'unknown' }
        : null;
    },

    /** @param {GameSnapshot} state @param {GameSnapshot} prevState */
    observe(state, prevState) {
      if (destroyed || !match || state?.gameState === prevState?.gameState) return;

      if (state?.gameState === 'PLAYING') {
        if (!match.started && prevState?.gameState === 'COUNTDOWN') {
          match.started = true;
          // Mode is final here, not when a menu or name-entry screen opened.
          match.mode = safeMode(state.gameMode);
          match.isTrackingAllowed = track('play_start', match.mode);
        }
        return;
      }

      if (state?.gameState === 'GAME_OVER') {
        const completedMatch = match;
        match = null; // Clear before sending, including duplicate online endings.
        if (completedMatch.started && completedMatch.isTrackingAllowed) {
          track('play_complete', completedMatch.mode);
        }
        return;
      }

      if (state?.gameState !== 'COUNTDOWN' && state?.gameState !== 'ROUND_OVER') {
        // Menus, disconnect setup, and name entry abandon the current match.
        match = null;
      }
    },

    ready() {
      if (destroyed || readyMarked) return;
      readyMarked = true;
      try {
        // The client handles a later grant/tag load. No action backlog lives here.
        analytics.markReady();
      } catch {
        // Optional measurement must never interrupt successful initialization.
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      match = null;
      try {
        unsubscribeConsent?.();
      } catch {
        // Teardown remains safe if the optional client has already shut down.
      }
      unsubscribeConsent = null;
    },
  };
}
