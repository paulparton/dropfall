import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLocalProfile,
  getLocalLeaderboard,
  getSelectedLocalProfile,
  loadLocalProfiles,
  normalizeDisplayName,
  recordLocalMatch,
  saveLocalProfiles,
  selectLocalProfile,
  updateLocalProfile,
} from '../src/services/localProfiles.js';

describe('local profiles and device scoreboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates, sanitizes, persists, and selects local profiles', () => {
    let state = loadLocalProfiles('First Pilot');
    const first = getSelectedLocalProfile(state);
    expect(first?.displayName).toBe('First Pilot');

    state = addLocalProfile(state, '  Second\u0000   Pilot  ');
    const second = getSelectedLocalProfile(state);
    expect(second?.displayName).toBe('Second Pilot');

    state = updateLocalProfile(state, second!.id, {
      displayName: 'Ace',
      ballColor: 0x123456,
      hat: 'crown',
    });
    state = selectLocalProfile(state, first!.id);
    expect(saveLocalProfiles(state)).toBe(true);

    const restored = loadLocalProfiles();
    expect(getSelectedLocalProfile(restored)?.id).toBe(first?.id);
    expect(restored.profiles.find((profile: { id: string }) => profile.id === second!.id)?.cosmetics)
      .toEqual({ ballColor: 0x123456, hat: 'crown' });
  });

  it('records matches idempotently and ranks the local board', () => {
    let state = loadLocalProfiles('Nova');
    const nova = getSelectedLocalProfile(state)!;
    state = addLocalProfile(state, 'Orbit');
    const orbit = getSelectedLocalProfile(state)!;

    state = recordLocalMatch(state, {
      profileId: nova.id,
      matchId: 'match-1',
      mode: '1P',
      opponentName: 'CPU',
      won: true,
      scoreFor: 3,
      scoreAgainst: 1,
      durationMs: 42_000,
    });
    state = recordLocalMatch(state, {
      profileId: nova.id,
      matchId: 'match-1',
      mode: '1P',
      opponentName: 'CPU',
      won: true,
      scoreFor: 3,
      scoreAgainst: 1,
      durationMs: 42_000,
    });
    state = recordLocalMatch(state, {
      profileId: orbit.id,
      matchId: 'match-2',
      mode: '2P',
      opponentName: 'Nova',
      won: false,
      scoreFor: 2,
      scoreAgainst: 3,
      durationMs: 50_000,
    });

    const board = getLocalLeaderboard(state);
    expect(board[0]).toMatchObject({ displayName: 'Nova', matches: 1, wins: 1 });
    expect(board[1]).toMatchObject({ displayName: 'Orbit', matches: 1, losses: 1 });
    expect(normalizeDisplayName('  A   B  ')).toBe('A B');
  });

  it('migrates retired novelty hats to the curated collection', () => {
    localStorage.setItem('dropfall_local_profiles_v1', JSON.stringify({
      version: 1,
      selectedProfileId: 'local_old',
      profiles: [{
        id: 'local_old',
        displayName: 'Legacy Pilot',
        cosmetics: { ballColor: 0xffffff, hat: 'pixel_crown' },
      }],
    }));

    expect(getSelectedLocalProfile(loadLocalProfiles())?.cosmetics.hat).toBe('crown');
  });
});
