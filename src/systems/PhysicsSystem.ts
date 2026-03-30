/**
 * PhysicsSystem - Manages Rapier3D physics with event-based API
 * 
 * Provides typed, lifecycle-aware physics management layer.
 * Replaces direct Rapier queries with event subscription pattern.
 * 
 * Lifecycle state machine: uninitialized → ready → stepping → disposed
 * 
 * @example
 * ```typescript
 * const physics = getPhysicsSystem();
 * await physics.initialize();
 * 
 * physics.on('collision', (events) => {
 *   events.forEach(e => game.handleCollision(e));
 * });
 * 
 * physics.on('out-of-bounds', (event) => {
 *   game.handleOutOfBounds(event);
 * });
 * 
 * // In game loop
 * physics.step(deltaTime);
 * 
 * physics.dispose();
 * ```
 */

import RAPIER, { EventQueue, World } from '@dimforge/rapier3d-compat';
import type { 
  PhysicsEvent, 
  CollisionEvent, 
  KnockbackEvent, 
  OutOfBoundsEvent 
} from '../types/Physics';
import { validatePhysicsEventResult } from '../validation/schemas';

/**
 * PhysicsSystem lifecycle states
 */
export type PhysicsLifecycle = 'uninitialized' | 'ready' | 'stepping' | 'disposed';

/**
 * Event listener type for physics events
 */
type PhysicsEventListener = (event: PhysicsEvent) => void;

/**
 * Body options for creating physics bodies
 */
export interface BodyOptions {
  /** Radius for ball colliders */
  radius?: number;
  /** Height for cylindrical/hexagonal colliders */
  height?: number;
  /** Mass of the body (for dynamic bodies) */
  mass?: number;
  /** Bounciness (0-1, higher = more bounce) */
  restitution?: number;
  /** Friction coefficient (0-1) */
  friction?: number;
  /** Whether this body is dynamic (has mass, responds to forces) */
  isDynamic?: boolean;
}

/**
 * Stored body reference with entity mapping
 */
interface StoredBody {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  entityId: string;
}

/**
 * PhysicsSystem - Manages Rapier3D world with event emission
 * 
 * @remarks
 * This class implements lazy initialization - Rapier is initialized
 * on first call to initialize(), not in constructor.
 */
export class PhysicsSystem {
  /** Current position in lifecycle state machine */
  private _lifecycle: PhysicsLifecycle = 'uninitialized';
  
  /** Handle to Rapier3D world */
  private world: RAPIER.World | null = null;
  
  /** Map of entity IDs to physics bodies */
  private bodies: Map<string, StoredBody> = new Map();
  
  /** Event listeners organized by event type */
  private listeners: Map<string, Set<PhysicsEventListener>> = new Map();
  
  /** Accumulator for fixed timestep simulation */
  private accumulator = 0;
  
  /** Rapier event queue for collision detection */
  private eventQueue: EventQueue | null = null;
  
  /** Fixed timestep for physics (1/60 for desktop, 1/30 for mobile) */
  private readonly timeStep: number;
  
  /** Arena boundaries for out-of-bounds detection */
  private readonly bounds = {
    minX: -20,
    maxX: 20,
    minY: -30,
    maxY: 30,
  };

  /**
   * Creates a new PhysicsSystem instance
   */
  constructor() {
    this._lifecycle = 'uninitialized';
    // Use lower timestep on mobile devices
    this.timeStep = this.isMobileDevice() ? 1 / 30 : 1 / 60;
  }

  /**
   * Read-only lifecycle state property
   */
  get lifecycle_state(): PhysicsLifecycle {
    return this._lifecycle;
  }

  /**
   * Check if running on mobile device
   */
  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)
      || window.innerWidth < 768;
  }

  /**
   * Initialize the physics world
   * 
   * @param existingWorld - Optional existing Rapier world to use instead of creating a new one
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(existingWorld?: World): Promise<void> {
    // Idempotent - already initialized
    if (this._lifecycle !== 'uninitialized') {
      console.warn('[PhysicsSystem] Already initialized, state:', this._lifecycle);
      return;
    }

    try {
      // If using existing world, don't reinitialize Rapier
      if (!existingWorld) {
        // Initialize Rapier WASM module
        await RAPIER.init();
        
        // Create world with custom gravity for Dropfall
        const gravity = { x: 0.0, y: -20.0, z: 0.0 };
        this.world = new RAPIER.World(gravity);
      } else {
        // Use existing world (e.g., from physics.js)
        this.world = existingWorld;
      }
      
      // Create event queue for collision detection
      this.eventQueue = new EventQueue(true);
      
      this._lifecycle = 'ready';
      console.log('[PhysicsSystem] Initialized successfully', existingWorld ? '(using existing world)' : '');
    } catch (error) {
      this._lifecycle = 'uninitialized';
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize PhysicsSystem: ${errorMessage}`);
    }
  }

  /**
   * Advance physics simulation by delta time
   * 
   * @param deltaTime - Time elapsed since last frame (seconds)
   */
  step(deltaTime: number): void {
    // State guard
    if (this._lifecycle !== 'ready' && this._lifecycle !== 'stepping') {
      throw new Error(
        `Cannot step: PhysicsSystem is ${this._lifecycle}, call initialize() first`
      );
    }

    if (!this.world) {
      throw new Error('Physics world not initialized');
    }

    this._lifecycle = 'stepping';

    try {
      this.accumulator += deltaTime;
      
      // Cap accumulator to prevent spiral of death if tab is inactive
      if (this.accumulator > 0.1) {
        this.accumulator = 0.1;
      }

      // Step physics multiple times if needed for fixed timestep
      let steppedThisFrame = false;
      while (this.accumulator >= this.timeStep) {
        // Clear event queue before stepping
        if (this.eventQueue) {
          this.eventQueue.drainCollisionEvents(() => {});
        }
        this.world.step(this.eventQueue || undefined);
        this.accumulator -= this.timeStep;
        steppedThisFrame = true;
      }

      // Emit collision events if world was stepped
      if (steppedThisFrame) {
        this.emitCollisionEvents();
        this.emitOutOfBoundsEvents();
      }

      this._lifecycle = 'ready';
    } catch (error) {
      this._lifecycle = 'ready';
      console.error('[PhysicsSystem] Error during step:', error);
    }
  }

  /**
   * Create a physics body for an entity
   * 
   * @param entityId - Unique identifier for the entity
   * @param position - Initial position {x, y, z}
   * @param options - Body configuration options
   * @returns Created body reference
   */
  createBody(
    entityId: string, 
    position: { x: number; y: number; z?: number }, 
    options: BodyOptions = {}
  ): { rigidBody: RAPIER.RigidBody; collider: RAPIER.Collider } {
    // State guard
    if (this._lifecycle !== 'ready' && this._lifecycle !== 'stepping') {
      throw new Error(
        `Cannot create body: PhysicsSystem is ${this._lifecycle}, call initialize() first`
      );
    }

    if (!this.world) {
      throw new Error('Physics world not initialized');
    }

    // Store world reference locally to maintain type narrowing
    const world = this.world;

    // Check if body already exists for this entity
    if (this.bodies.has(entityId)) {
      console.warn(`[PhysicsSystem] Body already exists for entity: ${entityId}`);
      return this.bodies.get(entityId)!;
    }

    const z = position.z ?? 0;
    const isDynamic = options.isDynamic ?? true;
    const mass = options.mass ?? 100.0;
    const restitution = options.restitution ?? 0.5;
    const friction = options.friction ?? 0.5;

    let rigidBody: RAPIER.RigidBody;
    let collider: RAPIER.Collider;

    if (isDynamic) {
      // Create dynamic body (player, dynamic objects)
      const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, z)
        .setLinearDamping(0.0)
        .setAngularDamping(0.0);
      rigidBody = world.createRigidBody(rigidBodyDesc);

      // Use ball collider for players
      const radius = options.radius ?? 1.5;
      const colliderDesc = RAPIER.ColliderDesc.ball(radius)
        .setMass(mass)
        .setFriction(friction)
        .setRestitution(restitution)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      collider = world.createCollider(colliderDesc, rigidBody);
    } else {
      // Create static/fixed body (arena tiles)
      const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, z);
      rigidBody = world.createRigidBody(rigidBodyDesc);

      // Use hexagonal prism for tiles
      if (options.radius && options.height) {
        const pts = [];
        const r = options.radius * 0.99; // 1% smaller than visual
        const h = options.height / 2;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = r * Math.sin(angle);
          const pz = r * Math.cos(angle);
          pts.push(px, h, pz);
          pts.push(px, -h, pz);
        }
        const colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts))!
          .setFriction(friction)
          .setRestitution(options.restitution ?? 0.1)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        collider = world.createCollider(colliderDesc, rigidBody);
      } else {
        // Default to fixed collider
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)
          .setFriction(friction)
          .setRestitution(restitution);
        collider = world.createCollider(colliderDesc, rigidBody);
      }
    }

    this.bodies.set(entityId, { rigidBody, collider, entityId });

    return { rigidBody, collider };
  }

  /**
   * Destroy a physics body
   * 
   * @param entityId - Unique identifier for the entity
   */
  destroyBody(entityId: string): void {
    // State guard
    if (this._lifecycle === 'disposed') {
      return;
    }

    const body = this.bodies.get(entityId);
    if (!body) {
      console.warn(`[PhysicsSystem] No body found for entity: ${entityId}`);
      return;
    }

    if (this.world) {
      this.world.removeCollider(body.collider, false);
      this.world.removeRigidBody(body.rigidBody);
    }

    this.bodies.delete(entityId);
  }

  /**
   * Apply force to a body
   * 
   * @param entityId - Unique identifier for the entity
   * @param force - Force vector {x, y, z}
   */
  applyForce(entityId: string, force: { x: number; y: number; z?: number }): void {
    // State guard
    if (this._lifecycle !== 'ready' && this._lifecycle !== 'stepping') {
      return;
    }

    const body = this.bodies.get(entityId);
    if (!body) {
      console.warn(`[PhysicsSystem] No body found for entity: ${entityId}`);
      return;
    }

    const z = force.z ?? 0;
    body.rigidBody.applyImpulse({ x: force.x, y: force.y, z: z }, true);
  }

  /**
   * Apply knockback force to a body
   * 
   * @param entityId - Unique identifier for the entity
   * @param force - 2D force vector {x, y}
   * @param duration - Duration of knockback effect (ms)
   */
  applyKnockback(entityId: string, force: { x: number; y: number }, duration: number): void {
    // Apply immediate impulse
    this.applyForce(entityId, { x: force.x, y: force.y, z: 0 });

    // Emit knockback event with validation
    const knockbackEvent: KnockbackEvent = {
      type: 'knockback',
      targetEntity: entityId,
      force,
      duration,
    };
    
    // Validate before emitting
    try {
      const validationResult = validatePhysicsEventResult(knockbackEvent);
      if (!validationResult.success) {
        console.warn('[PhysicsSystem] Knockback event validation failed:', validationResult.error);
        return;
      }
    } catch (error) {
      console.warn('[PhysicsSystem] Knockback event validation error:', error);
      return;
    }
    
    this.emit('knockback', knockbackEvent);
  }

  /**
   * Get current position of a body
   * 
   * @param entityId - Unique identifier for the entity
   * @returns Position {x, y, z} or null if body not found
   */
  getPosition(entityId: string): { x: number; y: number; z: number } | null {
    const body = this.bodies.get(entityId);
    if (!body) {
      return null;
    }

    const translation = body.rigidBody.translation();
    return { x: translation.x, y: translation.y, z: translation.z };
  }

  /**
   * Get current velocity of a body
   * 
   * @param entityId - Unique identifier for the entity
   * @returns Velocity {x, y, z} or null if body not found
   */
  getVelocity(entityId: string): { x: number; y: number; z: number } | null {
    const body = this.bodies.get(entityId);
    if (!body) {
      return null;
    }

    const linvel = body.rigidBody.linvel();
    return { x: linvel.x, y: linvel.y, z: linvel.z };
  }

  /**
   * Subscribe to physics events
   * 
   * @param eventType - Event type: 'collision', 'knockback', 'out-of-bounds'
   * @param listener - Callback function for the event
   * @returns Unsubscribe function
   */
  on(eventType: string, listener: PhysicsEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener);
    
    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * Unsubscribe from physics events
   * 
   * @param eventType - Event type
   * @param listener - Callback function to remove
   */
  off(eventType: string, listener: PhysicsEventListener): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * Emit event to all listeners
   * 
   * @param eventType - Event type
   * @param event - Event data
   */
  private emit(eventType: string, event: PhysicsEvent): void {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PhysicsSystem] Listener error:', error);
      }
    }
  }

  /**
   * Emit collision events from Rapier contact events
   */
  private emitCollisionEvents(): void {
    if (!this.world || !this.eventQueue) return;

    // Check if there are any collision listeners
    if (!this.listeners.has('collision') || this.listeners.get('collision')!.size === 0) {
      return;
    }

    // Create a reverse map from collider handle to entity ID
    const colliderToEntity = new Map<number, string>();
    for (const [entityId, body] of this.bodies) {
      colliderToEntity.set(body.collider.handle, entityId);
    }

    // Drain collision events from the queue
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const entityA = colliderToEntity.get(handle1);
      const entityB = colliderToEntity.get(handle2);

      // Only emit if we have both entity IDs
      if (!entityA || !entityB) return;

      // Calculate impulse based on body velocities (approximation)
      const bodyA = this.bodies.get(entityA);
      const bodyB = this.bodies.get(entityB);
      let impulse = 0;

      if (bodyA && bodyB) {
        const velA = bodyA.rigidBody.linvel();
        const velB = bodyB.rigidBody.linvel();
        const relVel = Math.sqrt(
          Math.pow(velA.x - velB.x, 2) +
          Math.pow(velA.y - velB.y, 2) +
          Math.pow(velA.z - velB.z, 2)
        );
        impulse = Math.min(relVel / 10, 10); // Clamp impulse
      }

      const collisionEvent: CollisionEvent = {
        type: 'collision',
        entityA,
        entityB,
        started,
        impulse,
      };

      // Validate the event before emitting
      try {
        const validationResult = validatePhysicsEventResult(collisionEvent);
        if (validationResult.success) {
          this.emit('collision', collisionEvent);
        } else {
          console.warn('[PhysicsSystem] Collision event validation failed:', validationResult.error);
        }
      } catch (error) {
        console.warn('[PhysicsSystem] Collision event validation error:', error);
      }
    });
  }

  /**
   * Emit out-of-bounds events for entities outside arena
   */
  private emitOutOfBoundsEvents(): void {
    if (!this.world) return;

    for (const [entityId, body] of this.bodies) {
      const position = body.rigidBody.translation();
      
      let direction: OutOfBoundsEvent['direction'] | null = null;
      let lastPosition = { x: 0, y: 0 };

      // Check each boundary
      if (position.x < this.bounds.minX) {
        direction = 'left';
        lastPosition = { x: this.bounds.minX, y: position.y };
      } else if (position.x > this.bounds.maxX) {
        direction = 'right';
        lastPosition = { x: this.bounds.maxX, y: position.y };
      } else if (position.y < this.bounds.minY) {
        direction = 'down';
        lastPosition = { x: position.x, y: this.bounds.minY };
      } else if (position.y > this.bounds.maxY) {
        direction = 'up';
        lastPosition = { x: position.x, y: this.bounds.maxY };
      }

      // Check corner cases (both X and Y out of bounds)
      if (direction && 
          ((position.x < this.bounds.minX || position.x > this.bounds.maxX) &&
           (position.y < this.bounds.minY || position.y > this.bounds.maxY))) {
        direction = 'corner';
      }

      if (direction) {
        const outOfBoundsEvent: OutOfBoundsEvent = {
          type: 'out-of-bounds',
          entity: entityId,
          lastPosition,
          direction,
        };
        
        // Validate before emitting
        try {
          const validationResult = validatePhysicsEventResult(outOfBoundsEvent);
          if (!validationResult.success) {
            console.warn('[PhysicsSystem] Out-of-bounds event validation failed:', validationResult.error);
            continue;
          }
        } catch (error) {
          console.warn('[PhysicsSystem] Out-of-bounds event validation error:', error);
          continue;
        }
        
        this.emit('out-of-bounds', outOfBoundsEvent);
      }
    }
  }

  /**
   * Get all registered entity IDs
   * 
   * @returns Array of entity IDs
   */
  getEntityIds(): string[] {
    return Array.from(this.bodies.keys());
  }

  /**
   * Check if physics system has a body for an entity
   * 
   * @param entityId - Unique identifier for the entity
   * @returns True if body exists
   */
  hasBody(entityId: string): boolean {
    return this.bodies.has(entityId);
  }

  /**
   * Check if physics system is ready
   * 
   * @returns True if lifecycle is 'ready' or 'stepping'
   */
  isReady(): boolean {
    return this._lifecycle === 'ready' || this._lifecycle === 'stepping';
  }

  /**
   * Check if physics system has been disposed
   * 
   * @returns True if lifecycle is 'disposed'
   */
  isDisposed(): boolean {
    return this._lifecycle === 'disposed';
  }

  /**
   * Dispose of all physics resources
   */
  dispose(): void {
    if (this._lifecycle === 'disposed') {
      console.warn('[PhysicsSystem] Already disposed');
      return;
    }

    try {
      // Destroy all bodies
      for (const entityId of Array.from(this.bodies.keys())) {
        this.destroyBody(entityId);
      }

      // Clear listeners
      this.listeners.clear();

      // Clear world reference (Rapier cleans up automatically)
      this.world = null;

      this._lifecycle = 'disposed';
      console.log('[PhysicsSystem] Disposed');
    } catch (error) {
      console.error('[PhysicsSystem] Error during dispose:', error);
    }
  }
}

// ===================================
// Singleton Instance
// ===================================

let instance: PhysicsSystem | null = null;

/**
 * Get the singleton PhysicsSystem instance
 * 
 * @returns The global PhysicsSystem instance
 */
export function getPhysicsSystem(): PhysicsSystem {
  if (!instance) {
    instance = new PhysicsSystem();
  }
  return instance;
}

/**
 * Reset the singleton instance (primarily for testing)
 * 
 * @internal
 */
export function resetPhysicsSystem(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
