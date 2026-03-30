import { describe, it, expect } from 'vitest';
import { useGameStore } from '../src/store';
import {
  GameStateSchema,
  InputPayloadSchema,
  PhysicsEventSchema,
  NetworkMessageSchema,
  GameModeSchema,
  DifficultySchema,
  validateGameState,
  validateInputPayload,
  validatePhysicsEvent,
  validateNetworkMessage,
  isVersionCompatible,
} from '../src/validation/schemas';
import type { GameState, GameMode } from '../src/types/Game';
import type { InputPayload } from '../src/types/Input';

describe('Type System Validation', () => {
  describe('Store Types', () => {
    it('should initialize store with valid default state', () => {
      const store = useGameStore.getState();
      expect(store).toBeDefined();
      expect(store.gameMode).toBeDefined();
      expect(['1P', '2P']).toContain(store.gameMode);
      expect(store.p1Score).toBeDefined();
      expect(store.p2Score).toBeDefined();
      expect(store.settings).toBeDefined();
    });

    it('should update game mode and transition game state', () => {
      useGameStore.getState().setGameMode('1P');
      let state = useGameStore.getState();
      expect(state.gameMode).toBe('1P');
      expect(state.gameState).toBe('DIFFICULTY_SELECT');

      useGameStore.getState().setGameMode('2P');
      state = useGameStore.getState();
      expect(state.gameMode).toBe('2P');
      expect(state.gameState).toBe('NAME_ENTRY');
    });

    it('should handle player name updates', () => {
      useGameStore.getState().setPlayerNames('Alice', 'Bob');
      let state = useGameStore.getState();
      expect(state.p1Name).toBe('Alice');
      expect(state.p2Name).toBe('Bob');
    });

    it('should manage boost levels correctly', () => {
      useGameStore.setState({ player1Boost: 50, player2Boost: 75 });
      useGameStore.getState().updateBoost('player1', 25);
      useGameStore.getState().updateBoost('player2', -50);

      let state = useGameStore.getState();
      expect(state.player1Boost).toBe(75);
      expect(state.player2Boost).toBe(25);

      // Test clamps
      useGameStore.getState().updateBoost('player1', 100);
      state = useGameStore.getState();
      expect(state.player1Boost).toBe(100);
    });

    it('should end rounds and transition to game over', () => {
      useGameStore.setState({ p1Score: 2, p2Score: 2});
      useGameStore.getState().endRound('Player 1');
      let state = useGameStore.getState();

      expect(state.gameState).toBe('GAME_OVER');
      expect(state.p1Score).toBe(3);
      expect(state.winner).toBe('Player 1');
    });
  });

  describe('Schema Validation - Game Modes', () => {
    it('should validate valid game modes', () => {
      const valid1P = GameModeSchema.safeParse('1P');
      const valid2P = GameModeSchema.safeParse('2P');
      const validAI = GameModeSchema.safeParse('AI');

      expect(valid1P.success).toBe(true);
      expect(valid2P.success).toBe(true);
      expect(validAI.success).toBe(true);
    });

    it('should reject invalid game modes', () => {
      const invalid = GameModeSchema.safeParse('ONLINE');
      expect(invalid.success).toBe(false);
    });
  });

  describe('Schema Validation - Input Payloads', () => {
    it('should validate keyboard input', () => {
      const keyboardInput: InputPayload = {
        source: 'keyboard',
        up: false,
        down: false,
        left: false,
        right: true,
        boost: false,
        timestamp: Date.now(),
      };

      const result = InputPayloadSchema.safeParse(keyboardInput);
      expect(result.success).toBe(true);
    });

    it('should validate gamepad input with analog sticks', () => {
      const gamepadInput: InputPayload = {
        source: 'gamepad',
        gamepadIndex: 0,
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0.5, y: -0.3 },
        timestamp: Date.now(),
      };

      const result = InputPayloadSchema.safeParse(gamepadInput);
      expect(result.success).toBe(true);
    });

    it('should validate AI input with difficulty and target', () => {
      const aiInput: InputPayload = {
        source: 'ai',
        difficulty: 'hard',
        targetPosition: { x: 100, y: -50 },
        up: true,
        down: false,
        left: false,
        right: false,
        boost: true,
        timestamp: Date.now(),
      };

      const result = InputPayloadSchema.safeParse(aiInput);
      expect(result.success).toBe(true);
    });

    it('should reject input with wrong source', () => {
      const invalidInput = {
        source: 'unknown',
        up: false,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };

      const result = InputPayloadSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Validation - Physics Events', () => {
    it('should validate collision events', () => {
      const collision = {
        type: 'collision' as const,
        entityA: 'player-1',
        entityB: 'arena',
        started: true,
        impulse: 150,
      };

      const result = PhysicsEventSchema.safeParse(collision);
      expect(result.success).toBe(true);
    });

    it('should validate knockback events', () => {
      const knockback = {
        type: 'knockback' as const,
        targetEntity: 'player-2',
        force: { x: 50, y: -30 },
        duration: 250,
      };

      const result = PhysicsEventSchema.safeParse(knockback);
      expect(result.success).toBe(true);
    });

    it('should validate out of bounds events with direction', () => {
      const outOfBounds = {
        type: 'out-of-bounds' as const,
        entity: 'player-1',
        lastPosition: { x: 505, y: 300 },
        direction: 'right' as const,
      };

      const result = PhysicsEventSchema.safeParse(outOfBounds);
      expect(result.success).toBe(true);
    });

    it('should reject event with invalid type', () => {
      const invalid = {
        type: 'invalid' as any,
        entityA: 'player-1',
        entityB: 'arena',
      };

      const result = PhysicsEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Validation - Network Messages', () => {
    it('should validate join messages', () => {
      const joinMsg = {
        type: 'join' as const,
        version: '1.0' as const,
        timestamp: Date.now(),
        playerId: 'player-123',
        gameMode: '1P' as const,
        playerName: 'Player One',
      };

      const result = NetworkMessageSchema.safeParse(joinMsg);
      expect(result.success).toBe(true);
    });

    it('should validate player move messages', () => {
      const moveMsg = {
        type: 'player-move' as const,
        version: '1.0' as const,
        timestamp: Date.now(),
        playerId: 'player-1',
        input: {
          source: 'keyboard' as const,
          up: true,
          down: false,
          left: false,
          right: false,
          boost: false,
          timestamp: Date.now(),
        },
      };

      const result = NetworkMessageSchema.safeParse(moveMsg);
      expect(result.success).toBe(true);
    });

    it('should validate round end messages with scores', () => {
      const roundEndMsg = {
        type: 'round-end' as const,
        version: '1.0' as const,
        timestamp: Date.now(),
        winner: 'Player 1',
        scores: {
          p1: 1,
          p2: 0,
        },
      };

      const result = NetworkMessageSchema.safeParse(roundEndMsg);
      expect(result.success).toBe(true);
    });

    it('should reject message with wrong version', () => {
      const wrongVersion = {
        type: 'join' as const,
        version: '2.0' as any,
        timestamp: Date.now(),
        playerId: 'player-1',
        gameMode: '1P' as const,
        playerName: 'Test',
      };

      const result = NetworkMessageSchema.safeParse(wrongVersion);
      expect(result.success).toBe(false);
    });
  });

  describe('Validator Functions', () => {
    it('should validate input payload without throwing', () => {
      const input: InputPayload = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };

      const result = validateInputPayload(input);
      expect(result).toEqual(input);
    });

    it('should throw on invalid input payload', () => {
      expect(() => {
        validateInputPayload({ source: 'unknown' });
      }).toThrow();
    });

    it('should validate physics events', () => {
      const event = {
        type: 'collision' as const,
        entityA: 'a',
        entityB: 'b',
        started: true,
        impulse: 100,
      };

      const result = validatePhysicsEvent(event);
      expect(result.type).toBe('collision');
    });

    it('should validate network messages', () => {
      const msg = {
        type: 'disconnect' as const,
        version: '1.0' as const,
        timestamp: Date.now(),
        playerId: 'p1',
      };

      const result = validateNetworkMessage(msg);
      expect(result.type).toBe('disconnect');
    });
  });

  describe('Protocol Version Checking', () => {
    it('should accept compatible version', () => {
      expect(isVersionCompatible('1.0')).toBe(true);
    });

    it('should reject incompatible versions', () => {
      expect(isVersionCompatible('2.0')).toBe(false);
      expect(isVersionCompatible('0.9')).toBe(false);
      expect(isVersionCompatible('')).toBe(false);
    });
  });

  describe('Difficulty Levels', () => {
    it('should validate all difficulty levels', () => {
      expect(DifficultySchema.safeParse('easy').success).toBe(true);
      expect(DifficultySchema.safeParse('normal').success).toBe(true);
      expect(DifficultySchema.safeParse('hard').success).toBe(true);
    });

    it('should reject invalid difficulty', () => {
      expect(DifficultySchema.safeParse('impossible').success).toBe(false);
    });
  });

  describe('Type Guards and Discriminated Unions', () => {
    it('should discriminate between input sources', () => {
      const keyboardPayload: InputPayload = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: 0,
      };

      const gamepadPayload: InputPayload = {
        source: 'gamepad',
        gamepadIndex: 0,
        up: false,
        down: true,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0, y: 0 },
        timestamp: 0,
      };

      expect(InputPayloadSchema.safeParse(keyboardPayload).success).toBe(true);
      expect(InputPayloadSchema.safeParse(gamepadPayload).success).toBe(true);
    });

    it('should discriminate between physics event types', () => {
      const events = [
        {
          type: 'collision' as const,
          entityA: 'a',
          entityB: 'b',
          started: true,
          impulse: 100,
        },
        {
          type: 'knockback' as const,
          targetEntity: 'a',
          force: { x: 10, y: 20 },
          duration: 100,
        },
        {
          type: 'out-of-bounds' as const,
          entity: 'a',
          lastPosition: { x: 0, y: 0 },
          direction: 'up' as const,
        },
      ];

      events.forEach((event) => {
        expect(PhysicsEventSchema.safeParse(event).success).toBe(true);
      });
    });
  });
});
