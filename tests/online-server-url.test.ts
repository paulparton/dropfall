import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineManager } from '../src/online.js';

describe('manual online server addresses', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['https://dropfall-game.com/dropfall-arena', 'wss://dropfall-game.com'],
    ['https://dropfall-game.com/dropfall-arena/', 'wss://dropfall-game.com'],
    ['https://dropfall-game.com/dropfall-arena?online=1', 'wss://dropfall-game.com'],
    ['https://dropfall-game.com/dropfall-arena/index.html?invite=a%2Bb#play', 'wss://dropfall-game.com'],
    ['https://dropfall.dropfall-game.com/dropfall-arena/index.html/', 'wss://dropfall.dropfall-game.com'],
    ['http://192.168.1.100:3000/dropfall-arena/?online=1', 'ws://192.168.1.100:3000'],
    ['dropfall-game.com/dropfall-arena/', 'ws://dropfall-game.com'],
    ['192.168.1.100:3000/dropfall-arena/index.html?online=1', 'ws://192.168.1.100:3000'],
    ['  https://dropfall-game.com/dropfall-arena/  ', 'wss://dropfall-game.com'],
  ])('uses the origin when a player pastes %s', (input, expected) => {
    expect(OnlineManager.normalizeServerUrl(input)).toBe(expected);
  });

  it.each([
    ['wss://custom.example/socket?token=abc', 'wss://custom.example/socket?token=abc'],
    ['ws://localhost:3000/dropfall-arena/', 'ws://localhost:3000/dropfall-arena'],
    ['wss://custom.example/dropfall-arena/index.html?token=abc', 'wss://custom.example/dropfall-arena/index.html?token=abc'],
    ['https://custom.example/socket?token=abc', 'wss://custom.example/socket?token=abc'],
    ['custom.example:3000/socket', 'ws://custom.example:3000/socket'],
    ['https://custom.example/dropfall-arena-2/', 'wss://custom.example/dropfall-arena-2'],
    ['https://custom.example/dropfall-arena/spectate', 'wss://custom.example/dropfall-arena/spectate'],
  ])('preserves custom server routes for %s', (input, expected) => {
    expect(OnlineManager.normalizeServerUrl(input)).toBe(expected);
  });

  it('continues to use the default server for empty input', () => {
    vi.spyOn(OnlineManager, 'getDefaultServerUrl').mockReturnValue('wss://custom.example/socket');
    expect(OnlineManager.normalizeServerUrl(' ')).toBe('wss://custom.example/socket');
  });

  it.each([
    ['https://dropfall-game.com/dropfall-arena/?online=1', 'https://dropfall-game.com/api/network-info'],
    ['wss://custom.example:444/socket?token=abc', 'https://custom.example:444/api/network-info'],
    ['192.168.1.100:3000/dropfall-arena/index.html', 'http://192.168.1.100:3000/api/network-info'],
  ])('requests network metadata at the origin for %s', async (input, expected) => {
    const info = { port: 3000, gameUrls: ['http://192.168.1.100:3000/dropfall-arena/'] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => info });
    vi.stubGlobal('fetch', fetchMock);

    expect(await OnlineManager.fetchNetworkInfo(input)).toEqual(info);
    expect(fetchMock).toHaveBeenCalledWith(expected);
  });

  it('returns no metadata when a malformed server address cannot be parsed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await OnlineManager.fetchNetworkInfo('http://[')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
