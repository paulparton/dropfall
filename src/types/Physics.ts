/**
 * Physics Type System - Rapier3D Integration and Collision Events
 *
 * Defines physics bodies, collision detection events, and knockback mechanics.
 * Abstracts Rapier3D details behind TypeScript interfaces.
 */

/**
 * PhysicsBody - Represents a physics object in the Rapier3D world
 * rHandle: Stores the Rapier ColliderHandle reference
 */
export interface PhysicsBody {
  /**
   * Rapier ColliderHandle - runtime reference to Rapier3D collider
   * Typed as 'any' to avoid importing rapier library (avoids runtime dependency in types)
   */
  rHandle: any;

  /** Which entity owns this physics body */
  entityId: string;

  /** Whether this body has mass (moves) or is static (kinematic boundaries) */
  isDynamic: boolean;
}

/**
 * CollisionEvent - Two entities have collided
 */
export interface CollisionEvent {
  type: 'collision';
  /** ID of first entity involved */
  entityA: string;
  /** ID of second entity involved */
  entityB: string;
  /** True if collision started, false if ended */
  started: boolean;
  /** Force/impulse of the collision */
  impulse: number;
}

/**
 * KnockbackEvent - One entity knocks back another
 * Used for pushback mechanics (shockwave, boost collision, etc.)
 */
export interface KnockbackEvent {
  type: 'knockback';
  /** Entity being knocked back */
  targetEntity: string;
  /** Force vector applied */
  force: {
    x: number;
    y: number;
  };
  /** How long the knockback effect lasts (ms) */
  duration: number;
}

/**
 * OutOfBoundsEvent - Entity left the game arena
 * Causes round end (player falls off)
 */
export interface OutOfBoundsEvent {
  type: 'out-of-bounds';
  /** Entity that went out of bounds */
  entity: string;
  /** Last valid position before going out of bounds */
  lastPosition: {
    x: number;
    y: number;
  };
  /** Which side of arena boundary was crossed */
  direction: 'up' | 'down' | 'left' | 'right' | 'corner';
}

/**
 * PhysicsEvent - Discriminated union of all physics events
 * Use type field to narrow the concrete event type
 */
export type PhysicsEvent = CollisionEvent | KnockbackEvent | OutOfBoundsEvent;

/**
 * PhysicsWorld - Interface for physics simulation
 * Abstracts Rapier3D details
 */
export interface PhysicsWorld {
  /** Advance physics simulation one frame */
  step(): void;

  /** Create a dynamic body (has mass, responds to forces) */
  createDynamicBody(entityId: string, position: { x: number; y: number }, size: { w: number; h: number }): PhysicsBody;

  /** Remove a body from simulation */
  destroyBody(body: PhysicsBody): void;

  /** Get all collision events since last step */
  queryCollisions(): CollisionEvent[];

  /** Apply force to a body */
  applyForce(body: PhysicsBody, force: { x: number; y: number }): void;
}

/**
 * Type guard - checks if an object is a valid PhysicsEvent
 */
export function isPhysicsEvent(obj: unknown): obj is PhysicsEvent {
  if (typeof obj !== 'object' || obj === null) return false;

  const event = obj as Record<string, unknown>;

  // Check type discriminant
  const validTypes = ['collision', 'knockback', 'out-of-bounds'];
  return validTypes.includes(event.type as string);
}

/**
 * Event-specific type guard - collision event
 */
export function isCollisionEvent(e: PhysicsEvent): e is CollisionEvent {
  return e.type === 'collision' && 'entityA' in e && 'entityB' in e;
}

/**
 * Event-specific type guard - knockback event
 */
export function isKnockbackEvent(e: PhysicsEvent): e is KnockbackEvent {
  return e.type === 'knockback' && 'targetEntity' in e && 'force' in e;
}

/**
 * Event-specific type guard - out of bounds event
 */
export function isOutOfBoundsEvent(e: PhysicsEvent): e is OutOfBoundsEvent {
  return e.type === 'out-of-bounds' && 'entity' in e && 'direction' in e;
}
