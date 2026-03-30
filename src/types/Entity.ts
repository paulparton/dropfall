/**
 * Entity Type System - Core Types for Game Objects
 *
 * Defines the foundational Entity interface and lifecycle patterns.
 * All game objects (Player, Arena, Effects) will implement or extend these types.
 */

/** Type discriminant for different entity kinds */
export type EntityType = 'player' | 'arena' | 'effect' | 'particle' | 'lightning' | 'shockwave';

/** Entity lifecycle state machine - tracks object from creation to destruction */
export type EntityState = 'created' | 'ready' | 'active' | 'destroyed';

/** Placeholder context for Phase 3 integration - will be expanded with full system interfaces */
export interface GameContext {
  deltaTime: number;
  gameState: unknown;
  physics: unknown;
  audio: unknown;
}

/** Collision event interface - placeholder for Physics.ts integration */
export interface CollisionEvent {
  type: 'collision';
  [key: string]: unknown;
}

/**
 * EntityLifecycleHooks - Optional lifecycle methods for entity behavior
 * Allows entities to respond to lifecycle events
 */
export interface EntityLifecycleHooks {
  /**
   * Initialize the entity - called when entity first becomes "ready"
   * Async to support async setup (loading resources, connecting to systems)
   */
  initialize?(context: GameContext): Promise<void>;

  /**
   * Update entity state each frame
   * Called during active state with deltaTime since last update
   */
  update?(deltaTime: number, context: GameContext): void;

  /**
   * Clean up resources - called when entity transitions to "destroyed"
   * Async to support async cleanup (detaching event listeners, releasing resources)
   */
  destroy?(): Promise<void>;

  /**
   * Handle collision events - called when this entity collides with another
   */
  onCollision?(event: CollisionEvent): void;
}

/**
 * Entity - Base interface for all game objects
 * Combines state properties with optional lifecycle hooks
 */
export interface Entity extends EntityLifecycleHooks {
  /** Unique identifier for this entity instance */
  id: string;

  /** Discriminant - what kind of entity this is */
  type: EntityType;

  /** Current position in lifecycle state machine */
  state: EntityState;

  /** 2D position in world space */
  position: {
    x: number;
    y: number;
  };

  /** Extensible metadata for entity-specific properties */
  metadata?: Record<string, unknown>;
}

/**
 * Type guard - checks if an object is a valid Entity
 * Verifies required properties and valid discriminants
 */
export function isEntity(obj: unknown): obj is Entity {
  if (typeof obj !== 'object' || obj === null) return false;

  const entity = obj as Record<string, unknown>;

  // Check required string properties
  if (typeof entity.id !== 'string') return false;
  if (typeof entity.state !== 'string') return false;

  // Check type discriminant
  const validTypes: EntityType[] = ['player', 'arena', 'effect', 'particle', 'lightning', 'shockwave'];
  if (!validTypes.includes(entity.type as EntityType)) return false;

  // Check position structure
  if (
    typeof entity.position !== 'object' ||
    entity.position === null ||
    typeof (entity.position as Record<string, unknown>).x !== 'number' ||
    typeof (entity.position as Record<string, unknown>).y !== 'number'
  ) {
    return false;
  }

  return true;
}

/**
 * PlayerEntity - Specialized entity type for player characters
 * Extends base Entity with player-specific properties
 */
export interface PlayerEntity extends Entity {
  type: 'player';
  health: number;
  velocity: {
    x: number;
    y: number;
  };
}

/**
 * ArenaEntity - Specialized entity type for game arena/boundaries
 * Extends base Entity with arena-specific properties
 */
export interface ArenaEntity extends Entity {
  type: 'arena';
  bounds: {
    width: number;
    height: number;
  };
}

/**
 * Type refinement - discriminated union helper for player entities
 */
export function isPlayerEntity(entity: Entity): entity is PlayerEntity {
  return entity.type === 'player' && 'health' in entity && 'velocity' in entity;
}

/**
 * Type refinement - discriminated union helper for arena entities
 */
export function isArenaEntity(entity: Entity): entity is ArenaEntity {
  return entity.type === 'arena' && 'bounds' in entity;
}
