import { describe, expect, it } from 'vitest';
import { BATTLE_RULES, GAME_RULES_VERSION } from '../shared/gameRules.js';

describe('shared battle rules', () => {
  it('defines the canonical match and reconnect timing contract', () => {
    expect(GAME_RULES_VERSION).toBe(1);
    expect(BATTLE_RULES).toEqual({
      winsToWinMatch: 3,
      countdownSeconds: 3,
      roundOverDelayMs: 2000,
      reconnectGraceMs: 30000,
    });
  });
});
