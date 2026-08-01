import { describe, expect, it, vi } from 'vitest';
import { GameRoom } from '../server/game/GameRoom.js';
import { getOnlineSpawnPosition } from '../shared/spawnPositions.js';

function createRoom(randomValue = 0) {
  const room = new GameRoom('room-test', 'host-id', 'Host', {
    theme: 'beach',
    arenaSize: 5,
  }, { random: () => randomValue });
  room.addPlayer('host-id', 'Host', null);
  room.addPlayer('guest-id', 'Guest', null);
  return room;
}

describe('multiplayer room settings', () => {
  it('keeps a validated settings and picker snapshot on each room', () => {
    const room = createRoom();
    const game = room.getPublicGame();

    expect(game.settings.theme).toBe('beach');
    expect(game.settings.arenaSize).toBe(5);
    expect(game.settings.sphereWeight).toBe(200);
    expect(game.hostId).toBe('host-id');
    expect(game.settingsPickerId).toBe('host-id');
    expect(game.settingsPickerReason).toBe('initial_random');
    expect(game.matchNumber).toBe(1);
  });

  it('randomly selects either player for the first match', () => {
    expect(createRoom(0).settingsPickerId).toBe('host-id');
    expect(createRoom(0.999).settingsPickerId).toBe('guest-id');
  });

  it('allows only the selected player to update lobby settings', () => {
    const room = createRoom(0.999);

    expect(room.updateSettings('host-id', { arenaSize: 12 })).toBeNull();
    expect(room.settings.arenaSize).toBe(5);

    const updated = room.updateSettings('guest-id', { theme: 'inferno', arenaSize: 12 });
    expect(updated?.theme).toBe('inferno');
    expect(updated?.arenaSize).toBe(12);
  });

  it('clamps hostile or invalid room settings', () => {
    const room = createRoom();
    const updated = room.updateSettings('host-id', {
      theme: 'unknown',
      arenaSize: 1000,
      sphereSize: -4,
      sphereWeight: 'not-a-number',
      collisionBounce: 9,
    });

    expect(updated).toMatchObject({
      theme: 'tron',
      arenaSize: 16,
      sphereSize: 0.5,
      sphereWeight: 200,
      collisionBounce: 1.5,
    });
    expect(Object.keys(updated || {})).not.toContain('admin');
  });

  it('clears both ready states when the selected player changes rules', () => {
    const room = createRoom();
    room.setReady('host-id', true);
    room.setReady('guest-id', true);
    expect(room.areBothReady()).toBe(true);

    room.updateSettings('host-id', { destructionRate: 8 });

    expect(room.areBothReady()).toBe(false);
    expect(room.players.every((player) => player.ready === false)).toBe(true);
  });

  it('assigns the previous match loser to pick the next match', () => {
    const room = createRoom();
    room.matchWinner = 1;
    room.scores = { p1: 3, p2: 1 };

    room._endMatch();

    expect(room.settingsPickerId).toBe('guest-id');
    expect(room.settingsPickerReason).toBe('previous_match_loser');
    expect(room.getPublicGame().settingsPickerId).toBe('guest-id');
  });

  it('returns both players to settings instead of auto-starting a rematch', () => {
    const room = createRoom();
    room.matchWinner = 1;
    room.scores = { p1: 3, p2: 2 };
    room._endMatch();

    room.requestRematch('host-id');
    room.requestRematch('guest-id');

    expect(room.state).toBe('LOBBY');
    expect(room.matchNumber).toBe(2);
    expect(room.settingsPickerId).toBe('guest-id');
    expect(room.players.every((player) => player.ready === false)).toBe(true);
  });

  it('preserves rematch requests made during the final round result', () => {
    const room = createRoom();
    room.state = 'ROUND_OVER';
    room.matchWinner = 1;
    room.scores = { p1: 3, p2: 0 };
    room.requestRematch('host-id');
    room.requestRematch('guest-id');

    room._endMatch();

    expect(room.state).toBe('LOBBY');
    expect(room.matchNumber).toBe(2);
    expect(room.settingsPickerId).toBe('guest-id');
  });

  it('keeps a baseline snapshot so both clients can visualize setting deltas', () => {
    const room = createRoom();
    const baseline = room.getPublicGame().settingsBaseline;

    room.updateSettings('host-id', { arenaSize: 8, collisionBounce: 1.3 });
    const game = room.getPublicGame();

    expect(game.settings.arenaSize).toBe(8);
    expect(game.settings.collisionBounce).toBe(1.3);
    expect(game.settingsBaseline).toEqual(baseline);
    expect(game.settingsBaseline.arenaSize).toBe(5);
  });

  it('lets only the non-picker start hurry-up and forces the picker ready after ten seconds', () => {
    vi.useFakeTimers();
    const room = createRoom(0);
    const messages: Array<Record<string, unknown>> = [];
    for (const player of room.players) player.ws = { readyState: 1 };
    room.onBroadcast = (_playerId: string, message: Record<string, unknown>) => messages.push(message);

    try {
      expect(room.settingsPickerId).toBe('host-id');
      expect(room.startHurryUp('host-id')).toBeNull();
      expect(room.startHurryUp('guest-id')).toMatchObject({ targetId: 'host-id', durationMs: 10000 });
      expect(room.getPublicGame().hurryUp?.targetSlot).toBe(1);

      vi.advanceTimersByTime(10000);

      expect(room.players.find(player => player.id === 'host-id')?.ready).toBe(true);
      expect(room.getPublicGame().hurryUp).toBeNull();
      expect(messages.some(message => message.type === 'hurry_up_started')).toBe(true);
      expect(messages.some(message => message.type === 'hurry_up_finished')).toBe(true);
      expect(messages.some(message => message.type === 'ready_state' && message.forced === true)).toBe(true);
      expect(room.updateSettings('host-id', { arenaSize: 10 })).toBeNull();
    } finally {
      room.destroy();
      vi.useRealTimers();
    }
  });

  it('retains a disconnected player slot during between-match setup', () => {
    const room = createRoom();
    room.hasStartedMatch = true;
    room.state = 'LOBBY';

    const result = room.removePlayer('guest-id');

    expect(result).toMatchObject({ disconnected: true, slot: 2 });
    expect(room.players).toHaveLength(2);
    expect(room.players.find(player => player.id === 'guest-id')?.disconnected).toBe(true);

    const reconnected = room.reconnect('guest-id', 'guest-rejoined', { readyState: 1 });
    expect(reconnected).toMatchObject({ id: 'guest-rejoined', slot: 2, disconnected: false });
    room.destroy();
  });

  it('returns the survivor to a usable lobby when reconnect grace expires', () => {
    const room = createRoom();
    room.hasStartedMatch = true;
    room.state = 'PLAYING';
    room.removePlayer('guest-id');
    const disconnected = room.players.find(player => player.id === 'guest-id');
    if (disconnected) disconnected.reconnectDeadline = Date.now() - 1;

    room._cleanupDisconnectedSlot(2);

    expect(room.state).toBe('LOBBY');
    expect(room.players).toHaveLength(1);
    expect(room.settingsPickerId).toBe('host-id');
    expect(room.players[0].ready).toBe(false);
    room.destroy();
  });

  it('transfers room ownership independently from settings authority', () => {
    const room = createRoom();
    const result = room.removePlayer('host-id');

    expect(result).toMatchObject({ disconnected: false, newHostId: 'guest-id' });
    expect(room.hostId).toBe('guest-id');
    expect(room.hostName).toBe('Guest');
    expect(room.settingsPickerId).toBeNull();
  });
});

describe('simulation pacing', () => {
  function playingRoom() {
    const room = createRoom();
    room.state = 'PLAYING';
    room.simulationClock = 10_000;
    room.tickAccumulator = 0;
    const ticks = vi.fn();
    room._tick = ticks;
    return { room, ticks };
  }

  it('catches up ticks lost to a late timer instead of dropping simulated time', () => {
    const { room, ticks } = playingRoom();

    // Timer fires 50ms late: three 60Hz steps of real time have elapsed.
    room._advanceSimulation(10_050);

    expect(ticks).toHaveBeenCalledTimes(3);
    expect(ticks).toHaveBeenCalledWith(1 / 60);
    room.destroy();
  });

  it('keeps simulated time aligned with wall-clock time across uneven timers', () => {
    const { room, ticks } = playingRoom();

    let now = 10_000;
    for (const gap of [16, 21, 12, 18, 15, 19, 14, 17, 16, 18, 20, 14]) {
      now += gap;
      room._advanceSimulation(now);
    }

    const elapsedSeconds = (now - 10_000) / 1000;
    const simulatedSeconds = ticks.mock.calls.length / 60;
    expect(Math.abs(simulatedSeconds - elapsedSeconds)).toBeLessThan(1 / 60);
    room.destroy();
  });

  it('does not try to replay a long stall in one frame', () => {
    const { room, ticks } = playingRoom();

    room._advanceSimulation(15_000);

    expect(ticks).toHaveBeenCalledTimes(5);
    room.destroy();
  });
});

describe('spawn parity between client and server', () => {
  it('places the authoritative bodies at the shared spawn positions', async () => {
    const room = createRoom();
    await room.initPhysics();
    room._resetRound();

    for (const playerInfo of room.players) {
      const expected = getOnlineSpawnPosition(playerInfo.slot, room.settings);
      const actual = playerInfo.player.body.translation();
      expect(actual.x).toBeCloseTo(expected.x, 5);
      expect(actual.y).toBeCloseTo(expected.y, 5);
      expect(actual.z).toBeCloseTo(expected.z, 5);
    }

    room.destroy();
  });

  it('separates the two spawns and lifts them clear of the tile surface', () => {
    const settings = { sphereSize: 3 };
    const p1 = getOnlineSpawnPosition(1, settings);
    const p2 = getOnlineSpawnPosition(2, settings);

    expect(p1.x).toBeLessThan(0);
    expect(p2.x).toBeGreaterThan(0);
    expect(p1.y).toBe(p2.y);
    // Tile surface (2) + radius (3) leaves the ball clear of the floor.
    expect(p1.y).toBeGreaterThan(2 + settings.sphereSize);
  });
});
