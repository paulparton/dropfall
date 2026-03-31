/**
 * Entity Base Class - Core Implementation for All Game Entities
 *
 * Provides the foundation for all game objects with lifecycle management,
 * event emission, and integration with Three.js meshes and Rapier physics.
 */

import type { EntityState, EntityType, EntityLifecycleHooks, GameContext, CollisionEvent } from '../types/Entity';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

// Entity Events
export type EntityEventType = 'collision' | 'death' | 'spawn' | 'destroy' | 'stateChange';

export interface EntityEvent {
  type: EntityEventType;
  entityId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Event Emitter for entities
type EventListener = (event: EntityEvent) => void;

export class EntityEventEmitter {
  private listeners: Map<EntityEventType, Set<EventListener>> = new Map();

  on(type: EntityEventType, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  off(type: EntityEventType, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(event: EntityEvent): void {
    this.listeners.get(event.type)?.forEach(listener => listener(event));
  }

  /**
   * Remove all listeners - useful for cleanup
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get listener count for a specific event type
   */
  listenerCount(type: EntityEventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/**
 * EntityBase - Abstract base class for all game entities
 *
 * Provides:
 * - Unique ID and entity type
 * - Lifecycle state management (created → ready → active → destroyed)
 * - Position tracking synced with physics rigid body
 * - Event emission system for entity lifecycle events
 * - Optional Three.js mesh and Rapier rigid body integration
 */
export abstract class EntityBase implements EntityLifecycleHooks {
  readonly id: string;
  readonly type: EntityType;
  state: EntityState = 'created';
  position: { x: number; y: number };

  mesh?: THREE.Object3D;
  rigidBody?: RigidBody;
  readonly events = new EntityEventEmitter();
  metadata: Record<string, unknown> = {};

  constructor(id: string, type: EntityType, position: { x: number; y: number }) {
    this.id = id;
    this.type = type;
    this.position = position;
  }

  async initialize(context: GameContext): Promise<void> {
    this.state = 'ready';
    this.events.emit({
      type: 'spawn',
      entityId: this.id,
      timestamp: Date.now()
    });
  }

  update(deltaTime: number, context: GameContext): void {
    if (this.state === 'ready') {
      this.state = 'active';
    }

    // Sync position from physics rigid body if available
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      this.position = { x: pos.x, y: pos.z };
    }
  }

  async destroy(): Promise<void> {
    this.state = 'destroyed';
    this.events.emit({
      type: 'destroy',
      entityId: this.id,
      timestamp: Date.now()
    });

    // Remove mesh from parent if exists
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
    }

    // Clean up event listeners
    this.events.clear();
  }

  /**
   * Handle collision events - called when this entity collides with another
   */
  onCollision?(event: CollisionEvent): void;

  /**
   * Emit a state change event
   */
  protected emitStateChange(newState: EntityState, oldState: EntityState): void {
    this.events.emit({
      type: 'stateChange',
      entityId: this.id,
      timestamp: Date.now(),
      data: { newState, oldState }
    });
  }

  /**
   * Emit a death event
   */
  protected emitDeath(data?: Record<string, unknown>): void {
    this.events.emit({
      type: 'death',
      entityId: this.id,
      timestamp: Date.now(),
      data
    });
  }

  /**
   * Emit a collision event
   */
  protected emitCollision(event: CollisionEvent): void {
    this.events.emit({
      type: 'collision',
      entityId: this.id,
      timestamp: Date.now(),
      data: { ...event }
    });
  }
}
