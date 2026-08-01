import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishLevel } from '../src/levelLoader.js';
import { getAllLevels, getLevelById } from '../src/levels/levelProvider';

function generateHexGrid(radius: number) {
  const tiles = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      tiles.push({ coord: { q, r }, ability: 'NORMAL', height: 4 });
    }
  }
  return tiles;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('published level catalogue', () => {
  it('makes a successful publish immediately selectable without waiting for the server list', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'published-now', active: true, launchReady: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const level = {
      id: 'draft-now',
      name: 'Published Now',
      description: 'Immediately available',
      difficulty: 'normal',
      theme: 'default',
      mode: 'battle',
      active: true,
      tiles: generateHexGrid(4),
    };
    await publishLevel(level);

    const levels = await getAllLevels();
    const summary = levels.find(candidate => candidate.id === 'published-now');
    expect(summary?.name).toBe('Published Now');
    expect(summary?.launchReady).toBe(true);
    expect(summary?.tiles).toHaveLength(61);

    const details = await getLevelById('published-now');
    expect(details?.name).toBe('Published Now');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
