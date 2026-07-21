import { describe, expect, it, vi } from 'vitest';
import { selectRandomDestructionTiles } from '../src/utils/arenaDestruction.js';

describe('arena destruction selection', () => {
  it('can select a centre tile instead of restricting drops to the perimeter', () => {
    const tiles = [
      { id: 'centre', distanceToCenter: 0 },
      { id: 'middle', distanceToCenter: 8 },
      { id: 'edge', distanceToCenter: 24 },
    ];

    expect(selectRandomDestructionTiles(tiles, 1, () => 0)[0]?.id).toBe('centre');
  });

  it('samples distinct tiles without mutating the candidate list', () => {
    const tiles = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const random = vi.fn()
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0);

    const selected = selectRandomDestructionTiles(tiles, 2, random);

    expect(selected.map((tile) => tile.id)).toEqual([3, 1]);
    expect(new Set(selected).size).toBe(2);
    expect(tiles).toHaveLength(3);
  });
});
