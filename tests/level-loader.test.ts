import { describe, expect, it } from 'vitest';
import { getLevelApiBase } from '../src/levelLoader.js';

describe('level API routing', () => {
  it('uses the game origin so editor saves and the picker share one catalogue', () => {
    expect(getLevelApiBase()).toBe(`${window.location.origin}/api`);
  });
});
