import { describe, expect, it } from 'vitest';
import { GameRoom } from '../server/game/GameRoom.js';

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

  it('transfers room ownership independently from settings authority', () => {
    const room = createRoom();
    const result = room.removePlayer('host-id');

    expect(result).toMatchObject({ disconnected: false, newHostId: 'guest-id' });
    expect(room.hostId).toBe('guest-id');
    expect(room.hostName).toBe('Guest');
    expect(room.settingsPickerId).toBeNull();
  });
});
