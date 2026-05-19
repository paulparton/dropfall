import { describe, it, expect } from 'vitest';
import { useGameStore } from '../src/store';

describe('Game Flow', () => {
  describe('Game State', () => {
    it('should have a gameState property', () => {
      const store = useGameStore.getState();
      expect(store.gameState).toBeDefined();
    });

    it('should have gameMode property', () => {
      const store = useGameStore.getState();
      expect(store.gameMode).toBeDefined();
    });

    it('should have settings', () => {
      const store = useGameStore.getState();
      expect(store.settings).toBeDefined();
      expect(store.settings.sphereAccel).toBeDefined();
    });
  });

  describe('Score', () => {
    it('should track player scores', () => {
      const store = useGameStore.getState();
      expect(typeof store.p1Score).toBe('number');
      expect(typeof store.p2Score).toBe('number');
    });

    it('should reset scores', () => {
      const store = useGameStore.getState();
      store.resetScores();
      expect(store.p1Score).toBe(0);
      expect(store.p2Score).toBe(0);
    });
  });
});
