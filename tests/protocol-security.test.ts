import { describe, expect, it } from 'vitest';
import { parseClientMessage } from '../shared/protocolSchemas.js';
import {
  consumeFixedWindow,
  createOriginAllowlist,
  createReconnectToken,
  isOriginAllowed,
  secureTokenEqual,
} from '../server/security.js';

describe('client protocol validation', () => {
  it('accepts bounded gameplay input', () => {
    const result = parseClientMessage({
      type: 'player_input',
      forward: 1,
      right: -1,
      boost: true,
      tick: 42,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields and unbounded values', () => {
    expect(parseClientMessage({
      type: 'set_name',
      name: 'Player',
      isAdmin: true,
    }).success).toBe(false);
    expect(parseClientMessage({
      type: 'player_input',
      forward: 99,
      right: 0,
      boost: false,
      tick: 1,
    }).success).toBe(false);
  });

  it('requires a reconnect token for rejoin messages', () => {
    expect(parseClientMessage({
      type: 'rejoin_game',
      gameId: 'game_1',
    }).success).toBe(false);
    expect(parseClientMessage({
      type: 'rejoin_game',
      gameId: 'game_1',
      reconnectToken: createReconnectToken(),
    }).success).toBe(true);
  });

  it('accepts only hats in the curated cosmetic contract', () => {
    expect(parseClientMessage({
      type: 'set_customization',
      color: 0xff00ff,
      hat: 'cowboy',
      name: 'Pilot',
    }).success).toBe(true);
    expect(parseClientMessage({
      type: 'set_customization',
      color: 0xff00ff,
      hat: 'random_shape_hat',
      name: 'Pilot',
    }).success).toBe(false);
  });
});

describe('server security helpers', () => {
  it('allows same-origin and configured development origins only', () => {
    const allowlist = createOriginAllowlist('https://play.dropfall.example');
    expect(isOriginAllowed('http://192.168.1.20:3000', '192.168.1.20:3000', allowlist)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', 'localhost:3000', allowlist)).toBe(true);
    expect(isOriginAllowed('https://play.dropfall.example', 'api.dropfall.example', allowlist)).toBe(true);
    expect(isOriginAllowed('https://attacker.example', 'api.dropfall.example', allowlist)).toBe(false);
  });

  it('compares reconnect and editor tokens without partial matches', () => {
    const token = createReconnectToken();
    expect(secureTokenEqual(token, token)).toBe(true);
    expect(secureTokenEqual(`${token}x`, token)).toBe(false);
    expect(secureTokenEqual('', token)).toBe(false);
  });

  it('enforces fixed-window limits and resets at the next window', () => {
    const bucket = { windowStartedAt: 0, events: 0 };
    expect(consumeFixedWindow(bucket, 100, 2, 1000)).toBe(true);
    expect(consumeFixedWindow(bucket, 200, 2, 1000)).toBe(true);
    expect(consumeFixedWindow(bucket, 300, 2, 1000)).toBe(false);
    expect(consumeFixedWindow(bucket, 1200, 2, 1000)).toBe(true);
  });
});
