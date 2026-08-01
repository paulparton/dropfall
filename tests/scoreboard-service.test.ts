import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ScoreboardService } from '../server/services/ScoreboardService.js';

const tempDirectories: string[] = [];

function createService() {
  const directory = mkdtempSync(join(tmpdir(), 'dropfall-scoreboard-'));
  tempDirectories.push(directory);
  return {
    directory,
    service: new ScoreboardService(join(directory, 'scores.json'), { signingKey: 'test-key' }),
  };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('authoritative online scoreboard', () => {
  it('persists signed match events and an aggregate leaderboard', () => {
    const { directory, service } = createService();
    expect(service.recordMatch({
      matchId: 'match-1',
      roomId: 'room-1',
      matchNumber: 1,
      winnerSlot: 1,
      scores: { p1: 3, p2: 1 },
      players: [
        { slot: 1, name: 'Nova' },
        { slot: 2, name: 'Orbit' },
      ],
      durationMs: 60_000,
    })).toBe(true);

    expect(service.getLeaderboard()).toEqual([
      expect.objectContaining({ displayName: 'Nova', matches: 1, wins: 1, winRate: 1 }),
      expect.objectContaining({ displayName: 'Orbit', matches: 1, losses: 1, winRate: 0 }),
    ]);
    expect(service.recordMatch({
      matchId: 'match-1',
      winnerSlot: 1,
      players: [{ slot: 1, name: 'Nova' }, { slot: 2, name: 'Orbit' }],
    })).toBe(false);

    const stored = JSON.parse(readFileSync(join(directory, 'scores.json'), 'utf8'));
    expect(stored.matches[0].signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('survives restarts and rejects malformed outcomes', () => {
    const { directory, service } = createService();
    expect(service.recordMatch({ matchId: 'bad', winnerSlot: null, players: [] })).toBe(false);
    expect(existsSync(join(directory, 'scores.json'))).toBe(false);

    service.recordMatch({
      matchId: 'match-2',
      winnerSlot: 2,
      players: [{ slot: 1, name: 'A' }, { slot: 2, name: 'B' }],
      scores: { p1: 0, p2: 3 },
    });
    const restored = new ScoreboardService(join(directory, 'scores.json'), { signingKey: 'test-key' });
    expect(restored.getLeaderboard()[0]).toMatchObject({ displayName: 'B', wins: 1 });
  });
});
