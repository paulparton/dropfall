/**
 * Game Type System - Core Game State and Configuration Types
 *
 * Defines the complete game state interface and all game-related type discriminants.
 * References Entity types from Entity.ts.
 */

import type { Entity, EntityState, EntityLifecycleHooks, GameContext, CollisionEvent } from './Entity';

/**
 * Game mode discriminant - what type of game is being played
 */
export type GameMode = '1P' | '2P' | 'AI';

/**
 * Difficulty level - for single-player and AI modes
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

/**
 * Game phase - current state of the game progression
 * menu → loading → playing → paused → roundEnd → gameEnd
 */
export type GamePhase = 'menu' | 'loading' | 'playing' | 'paused' | 'roundEnd' | 'gameEnd';

/**
 * ArenaBounds - Configuration for the game arena/play area
 * Matches the existing Arena.js default dimensions (1000x600 pixels)
 */
export interface ArenaBounds {
  /** Width of the arena in pixels */
  width: number;

  /** Height of the arena in pixels */
  height: number;

  /** Minimum X coordinate (left edge) */
  minX: number;

  /** Maximum X coordinate (right edge) */
  maxX: number;

  /** Minimum Y coordinate (top edge) */
  minY: number;

  /** Maximum Y coordinate (bottom edge) */
  maxY: number;
}

/**
 * Default arena bounds - standard 1000x600 game area
 * Used as fallback when creating new games
 */
export const DEFAULT_ARENA_BOUNDS: ArenaBounds = {
  width: 1000,
  height: 600,
  minX: 0,
  maxX: 1000,
  minY: 0,
  maxY: 600,
};

/**
 * EntityMap - Type for storing entities by ID
 * Example: entities['player-1'] or entities['arena-0']
 */
export type EntityMap = Record<string, Entity>;

/**
 * Finalized GameContext including all full system references
 * Used by entities to access game systems during lifecycle
 */
export interface FullGameContext extends GameContext {
  gameState: GameState;
  physics: {
    raycast: (...args: unknown[]) => unknown;
    position: (...args: unknown[]) => unknown;
  };
  audio: {
    play: (...args: unknown[]) => unknown;
    stop: (...args: unknown[]) => unknown;
  };
  input: {
    getMovement: (...args: unknown[]) => unknown;
  };
}

/**
 * GameState - Complete immutable game state
 * This is the single source of truth for all game data
 * Persisted and managed by Zustand store
 */
export interface GameState {
  /** Unique session identifier for this game */
  id: string;

  /** Game mode: single-player, two-player, or AI-controlled */
  mode: GameMode;

  /** Current phase in game progression */
  phase: GamePhase;

  /** Difficulty level (optional, only relevant for 1P/AI modes) */
  difficulty?: Difficulty;

  /** Array of active player entities (1-2 players) */
  players: Entity[];

  /** The arena/play area entity */
  arena: Entity | null;

  /** All active entities indexed by ID for fast lookup */
  entities: EntityMap;

  /** Current round number (0-indexed) */
  round: number;

  /** Score tracker: {p1: points, p2: points} */
  score: {
    p1: number;
    p2: number;
  };

  /** Whether this is an online/networked game */
  isOnline: boolean;

  /** When this game session was created */
  createdAt: Date;

  /** Last time any state was updated */
  updatedAt: Date;
}

/**
 * Type guard - validates if an object conforms to GameState interface
 * Used for Zod parsing and runtime validation in Phase 3
 */
export function isValidGameState(obj: unknown): obj is GameState {
  if (typeof obj !== 'object' || obj === null) return false;

  const state = obj as Record<string, unknown>;

  // Check required properties
  if (typeof state.id !== 'string') return false;
  if (typeof state.phase !== 'string') return false;
  if (typeof state.round !== 'number' || state.round < 0) return false;
  if (!Array.isArray(state.players)) return false;
  if (typeof state.isOnline !== 'boolean') return false;
  if (!(state.createdAt instanceof Date)) return false;
  if (!(state.updatedAt instanceof Date)) return false;

  // Check score structure
  if (
    typeof state.score !== 'object' ||
    state.score === null ||
    typeof (state.score as Record<string, unknown>).p1 !== 'number' ||
    typeof (state.score as Record<string, unknown>).p2 !== 'number'
  ) {
    return false;
  }

  // Check mode discriminant
  const validModes: GameMode[] = ['1P', '2P', 'AI'];
  if (!validModes.includes(state.mode as GameMode)) return false;

  return true;
}

/**
 * Factory function - creates a new GameState with sensible defaults
 * Used by store initialization in Phase 3
 */
export function createGameState(mode: GameMode, difficulty?: Difficulty): GameState {
  return {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    mode,
    phase: 'loading',
    difficulty,
    players: [],
    arena: null,
    entities: {},
    round: 0,
    score: { p1: 0, p2: 0 },
    isOnline: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Re-export GameContext and CollisionEvent for convenience
 * Keeps type imports simplified when working with entities
 */
export type { GameContext, CollisionEvent, Entity, EntityState, EntityLifecycleHooks };
