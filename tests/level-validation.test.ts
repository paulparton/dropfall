import { describe, expect, it } from 'vitest';
import { isLevelActive, validateLevelForLaunch } from '../shared/levelValidation.js';
import { demoLevels } from '../src/levels/demoLevels';

describe('launch arena validation', () => {
  it('uses the explicit active flag and keeps legacy public levels compatible', () => {
    expect(isLevelActive({ active: true })).toBe(true);
    expect(isLevelActive({ active: false, isPublic: true })).toBe(false);
    expect(isLevelActive({ isPublic: true })).toBe(true);
    expect(isLevelActive({})).toBe(false);
  });

  it('accepts the curated classic battle arena with separated spawns', () => {
    const classic = demoLevels.find((level) => level.id === 'demo_classic');
    const result = validateLevelForLaunch(classic);

    expect(result.launchReady).toBe(true);
    expect(result.recommendedSpawns).toHaveLength(2);
    expect(result.stats.connectivity).toBe(1);
    expect(result.stats.spawnDistance).toBeGreaterThanOrEqual(5);
  });

  it('rejects one-tile editor experiments', () => {
    const result = validateLevelForLaunch({
      id: 'test',
      name: 'Test Arena',
      tiles: [{ coord: { q: 0, r: 0 }, ability: 'NORMAL', height: 4 }],
    });

    expect(result.launchReady).toBe(false);
    expect(result.issues.some((issue: string) => issue.includes('at least 19 tiles'))).toBe(true);
    expect(result.issues.some((issue: string) => issue.includes('safe, separated'))).toBe(true);
  });

  it('rejects disconnected islands and editor-only tile abilities', () => {
    const tiles = Array.from({ length: 19 }, (_, index) => ({
      coord: { q: index * 3, r: 0 },
      ability: index === 0 ? 'WARNING' : 'NORMAL',
      height: 4,
    }));
    const result = validateLevelForLaunch({ name: 'Broken', tiles });

    expect(result.launchReady).toBe(false);
    expect(result.issues.some((issue: string) => issue.includes('reachable surface'))).toBe(true);
    expect(result.issues.some((issue: string) => issue.includes('unsupported'))).toBe(true);
  });

  it('keeps race content out of the battle launch pool', () => {
    const race = demoLevels.find((level) => level.mode === 'race');
    const result = validateLevelForLaunch(race);

    expect(result.launchReady).toBe(false);
    expect(result.issues).toContain('This build does not ship the race ruleset.');
  });
});
