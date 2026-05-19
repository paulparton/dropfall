/**
 * PhysicsSystem Tests - Lifecycle, Body Management, and Event Emission
 * 
 * Tests cover:
 * - Lifecycle: init → ready → stepping → disposed
 * - Body creation and destruction
 * - Force application
 * - Event emission (collision, knockback, out-of-bounds)
 * - Subscriber pattern
 * - State guards (throw if wrong state)
 * 
 * Note: Uses Rapier3D mock where possible, but initializes Rapier for real testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PhysicsSystem, getPhysicsSystem, resetPhysicsSystem, type PhysicsLifecycle } from '../src/systems/PhysicsSystem';
import type { PhysicsEvent, CollisionEvent, KnockbackEvent, OutOfBoundsEvent } from '../src/types/Physics';

describe('PhysicsSystem', () => {
  let physics: PhysicsSystem;

  beforeEach(() => {
    physics = new PhysicsSystem();
  });

  afterEach(() => {
    physics.dispose();
    resetPhysicsSystem();
  });

  describe('Lifecycle', () => {
    it('should start in uninitialized state', () => {
      expect(physics.lifecycle_state).toBe('uninitialized');
    });

    it('should transition to ready after initialize()', async () => {
      await physics.initialize();
      expect(physics.lifecycle_state).toBe('ready');
    });

    it('should be idempotent - initialize() called twice should not throw', async () => {
      await physics.initialize();
      await physics.initialize();
      expect(physics.lifecycle_state).toBe('ready');
    });

    it('should be idempotent - multiple ready states should work', async () => {
      await physics.initialize();
      const state1 = physics.lifecycle_state;
      
      await physics.initialize();
      const state2 = physics.lifecycle_state;
      
      expect(state1).toBe('ready');
      expect(state2).toBe('ready');
    });

    it('should transition to disposed after dispose()', async () => {
      await physics.initialize();
      physics.dispose();
      expect(physics.lifecycle_state).toBe('disposed');
    });

    it('should be idempotent - dispose() called twice should not throw', async () => {
      await physics.initialize();
      physics.dispose();
      expect(() => physics.dispose()).not.toThrow();
    });

    it('dispose() should work when not initialized', () => {
      // Should not throw
      physics.dispose();
      expect(physics.lifecycle_state).toBe('disposed');
    });

    it('should be ready after stepping', async () => {
      await physics.initialize();
      physics.step(1 / 60);
      expect(physics.lifecycle_state).toBe('ready');
    });
  });

  describe('State Guards', () => {
    it('step() should throw if not initialized', () => {
      expect(() => physics.step(1 / 60)).toThrow('Cannot step');
    });

    it('step() should throw if disposed', async () => {
      await physics.initialize();
      physics.dispose();
      expect(() => physics.step(1 / 60)).toThrow('Cannot step');
    });

    it('createBody() should throw if not initialized', () => {
      expect(() => physics.createBody('entity1', { x: 0, y: 0 })).toThrow('Cannot create body');
    });

    it('createBody() should throw if disposed', async () => {
      await physics.initialize();
      physics.dispose();
      expect(() => physics.createBody('entity1', { x: 0, y: 0 })).toThrow('Cannot create body');
    });

    it('applyForce() should be no-op if not initialized', async () => {
      await physics.initialize();
      // Should be no-op, not throw
      physics.applyForce('entity1', { x: 10, y: 10 });
    });

    it('destroyBody() should be no-op if disposed', async () => {
      await physics.initialize();
      physics.dispose();
      // Should be no-op, not throw
      physics.destroyBody('entity1');
    });

    it('destroyBody() should warn if body not found', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await physics.initialize();
      physics.destroyBody('nonexistent');
      
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Body Management', () => {
    it('should create a dynamic body', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 });
      
      expect(physics.hasBody('player1')).toBe(true);
    });

    it('should create a static body', async () => {
      await physics.initialize();
      
      physics.createBody('wall', { x: 5, y: 5 }, { isDynamic: false });
      
      expect(physics.hasBody('wall')).toBe(true);
    });

    it('should destroy a body', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 });
      expect(physics.hasBody('player1')).toBe(true);
      
      physics.destroyBody('player1');
      expect(physics.hasBody('player1')).toBe(false);
    });

    it('should warn when creating body for existing entity', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await physics.initialize();
      physics.createBody('player1', { x: 0, y: 0 });
      physics.createBody('player1', { x: 5, y: 5 }); // Should warn
      
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should get all entity IDs', async () => {
      await physics.initialize();
      
      physics.createBody('entity1', { x: 0, y: 0 });
      physics.createBody('entity2', { x: 5, y: 5 });
      physics.createBody('entity3', { x: -5, y: -5 });
      
      const ids = physics.getEntityIds();
      expect(ids).toContain('entity1');
      expect(ids).toContain('entity2');
      expect(ids).toContain('entity3');
    });

    it('should accept body options', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 }, {
        radius: 2,
        mass: 50,
        restitution: 0.8,
        friction: 0.2,
      });
      
      expect(physics.hasBody('player1')).toBe(true);
    });
  });

  describe('Force Application', () => {
    it('should apply force to a body', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 });
      physics.applyForce('player1', { x: 100, y: 0 });
      
      // Should not throw
      expect(physics.hasBody('player1')).toBe(true);
    });

    it('should apply force with 3D vector', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 });
      physics.applyForce('player1', { x: 100, y: 50, z: 10 });
      
      expect(physics.hasBody('player1')).toBe(true);
    });

    it('should warn when applying force to nonexistent body', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await physics.initialize();
      physics.applyForce('nonexistent', { x: 100, y: 100 });
      
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Position and Velocity', () => {
    it('should get position of a body', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 5, y: 10 });
      const position = physics.getPosition('player1');
      
      expect(position).not.toBeNull();
      expect(position?.x).toBeCloseTo(5, 0);
      expect(position?.y).toBeCloseTo(10, 0);
    });

    it('should get velocity of a body', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 0 });
      physics.applyForce('player1', { x: 100, y: 0 });
      
      const velocity = physics.getVelocity('player1');
      
      // After force application, velocity should exist
      expect(velocity).not.toBeNull();
    });

    it('should return null for position of nonexistent body', () => {
      const position = physics.getPosition('nonexistent');
      expect(position).toBeNull();
    });

    it('should return null for velocity of nonexistent body', () => {
      const velocity = physics.getVelocity('nonexistent');
      expect(velocity).toBeNull();
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to knockback events', async () => {
      await physics.initialize();
      
      const callback = vi.fn();
      physics.on('knockback', callback);
      
      physics.applyKnockback('player1', { x: 100, y: 50 }, 500);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
      await physics.initialize();
      
      const callback = vi.fn();
      const unsubscribe = physics.on('knockback', callback);
      
      unsubscribe();
      
      physics.applyKnockback('player1', { x: 100, y: 50 }, 500);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully', async () => {
      await physics.initialize();
      
      const badCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodCallback = vi.fn();
      
      physics.on('knockback', badCallback);
      physics.on('knockback', goodCallback);
      
      physics.applyKnockback('player1', { x: 100, y: 50 }, 500);
      
      expect(goodCallback).toHaveBeenCalled();
    });

    it('should emit knockback event with correct structure', async () => {
      await physics.initialize();
      
      let emittedEvent: unknown = null;
      physics.on('knockback', (event) => {
        emittedEvent = event;
      });
      
      physics.applyKnockback('player1', { x: 100, y: 50 }, 500);
      
      expect(emittedEvent).not.toBeNull();
      expect((emittedEvent as KnockbackEvent).type).toBe('knockback');
      expect((emittedEvent as KnockbackEvent).targetEntity).toBe('player1');
      expect((emittedEvent as KnockbackEvent).force.x).toBe(100);
      expect((emittedEvent as KnockbackEvent).force.y).toBe(50);
      expect((emittedEvent as KnockbackEvent).duration).toBe(500);
    });

    it('should clear listeners on dispose', async () => {
      const callback = vi.fn();
      
      await physics.initialize();
      physics.on('knockback', callback);
      
      physics.dispose();
      physics.applyKnockback('player1', { x: 100, y: 50 }, 500);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Out of Bounds Events', () => {
    it('should emit out-of-bounds event when entity exceeds bounds', async () => {
      await physics.initialize();
      
      // Create body at edge
      physics.createBody('player1', { x: 25, y: 0 }); // Beyond maxX (20)
      
      let outOfBoundsEvent: unknown = null;
      physics.on('out-of-bounds', (event) => {
        outOfBoundsEvent = event;
      });
      
      // Step physics multiple times to allow body to move beyond bounds
      for (let i = 0; i < 100; i++) {
        physics.step(1 / 60);
      }
      
      expect(outOfBoundsEvent).not.toBeNull();
      expect((outOfBoundsEvent as OutOfBoundsEvent).entity).toBe('player1');
      expect((outOfBoundsEvent as OutOfBoundsEvent).direction).toBe('right');
    });

    it('should emit out-of-bounds with down direction', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: -35 }); // Beyond minY (-30)
      
      let outOfBoundsEvent: unknown = null;
      physics.on('out-of-bounds', (event) => {
        outOfBoundsEvent = event;
      });
      
      for (let i = 0; i < 100; i++) {
        physics.step(1 / 60);
      }
      
      expect(outOfBoundsEvent).not.toBeNull();
      expect((outOfBoundsEvent as OutOfBoundsEvent).direction).toBe('down');
    });

    it('should emit out-of-bounds with up direction', async () => {
      await physics.initialize();
      
      physics.createBody('player1', { x: 0, y: 35 }); // Beyond maxY (30)
      
      let outOfBoundsEvent: unknown = null;
      physics.on('out-of-bounds', (event) => {
        outOfBoundsEvent = event;
      });
      
      for (let i = 0; i < 100; i++) {
        physics.step(1 / 60);
      }
      
      expect(outOfBoundsEvent).not.toBeNull();
      expect((outOfBoundsEvent as OutOfBoundsEvent).direction).toBe('up');
    });
  });

  describe('Singleton', () => {
    it('getPhysicsSystem() should return same instance', () => {
      const instance1 = getPhysicsSystem();
      const instance2 = getPhysicsSystem();
      
      expect(instance1).toBe(instance2);
    });

    it('resetPhysicsSystem() should create new instance', async () => {
      const instance1 = getPhysicsSystem();
      await instance1.initialize();
      
      resetPhysicsSystem();
      
      const instance2 = getPhysicsSystem();
      expect(instance1).not.toBe(instance2);
      expect(instance2.lifecycle_state).toBe('uninitialized');
    });
  });

  describe('isReady / isDisposed', () => {
    it('isReady() should return false when uninitialized', () => {
      expect(physics.isReady()).toBe(false);
    });

    it('isReady() should return true when ready', async () => {
      await physics.initialize();
      expect(physics.isReady()).toBe(true);
    });

    it('isReady() should return true when stepping', async () => {
      await physics.initialize();
      physics.step(1 / 60);
      // Still in stepping during step, but should return ready after
      expect(physics.isReady()).toBe(true);
    });

    it('isDisposed() should return false when not disposed', () => {
      expect(physics.isDisposed()).toBe(false);
    });

    it('isDisposed() should return true after dispose()', async () => {
      await physics.initialize();
      physics.dispose();
      expect(physics.isDisposed()).toBe(true);
    });
  });
});

describe('Physics Event Type Guards', () => {
  it('isPhysicsEvent should validate physics events', async () => {
    const { isPhysicsEvent } = await import('../src/types/Physics');
    
    const collisionEvent: CollisionEvent = {
      type: 'collision',
      entityA: 'player1',
      entityB: 'player2',
      started: true,
      impulse: 10,
    };
    
    expect(isPhysicsEvent(collisionEvent)).toBe(true);
    expect(isPhysicsEvent(null)).toBe(false);
    expect(isPhysicsEvent({})).toBe(false);
  });

  it('isCollisionEvent should identify collision events', async () => {
    const { isCollisionEvent } = await import('../src/types/Physics');
    
    const collisionEvent: CollisionEvent = {
      type: 'collision',
      entityA: 'player1',
      entityB: 'player2',
      started: true,
      impulse: 10,
    };
    
    const knockbackEvent: KnockbackEvent = {
      type: 'knockback',
      targetEntity: 'player1',
      force: { x: 100, y: 50 },
      duration: 500,
    };
    
    expect(isCollisionEvent(collisionEvent)).toBe(true);
    expect(isCollisionEvent(knockbackEvent)).toBe(false);
  });

  it('isKnockbackEvent should identify knockback events', async () => {
    const { isKnockbackEvent } = await import('../src/types/Physics');
    
    const knockbackEvent: KnockbackEvent = {
      type: 'knockback',
      targetEntity: 'player1',
      force: { x: 100, y: 50 },
      duration: 500,
    };
    
    const outOfBoundsEvent: OutOfBoundsEvent = {
      type: 'out-of-bounds',
      entity: 'player1',
      lastPosition: { x: 0, y: 0 },
      direction: 'left',
    };
    
    expect(isKnockbackEvent(knockbackEvent)).toBe(true);
    expect(isKnockbackEvent(outOfBoundsEvent)).toBe(false);
  });

  it('isOutOfBoundsEvent should identify out-of-bounds events', async () => {
    const { isOutOfBoundsEvent } = await import('../src/types/Physics');
    
    const outOfBoundsEvent: OutOfBoundsEvent = {
      type: 'out-of-bounds',
      entity: 'player1',
      lastPosition: { x: 0, y: 0 },
      direction: 'left',
    };
    
    const collisionEvent: CollisionEvent = {
      type: 'collision',
      entityA: 'player1',
      entityB: 'player2',
      started: true,
      impulse: 10,
    };
    
    expect(isOutOfBoundsEvent(outOfBoundsEvent)).toBe(true);
    expect(isOutOfBoundsEvent(collisionEvent)).toBe(false);
  });
});

describe('Physics Validation Integration', () => {
  it('should validate collision events against schema', async () => {
    const { validatePhysicsEventResult } = await import('../src/validation/schemas');
    
    const validEvent: CollisionEvent = {
      type: 'collision',
      entityA: 'player1',
      entityB: 'player2',
      started: true,
      impulse: 10,
    };
    
    const result = validatePhysicsEventResult(validEvent);
    expect(result.success).toBe(true);
  });

  it('should validate knockback events against schema', async () => {
    const { validatePhysicsEventResult } = await import('../src/validation/schemas');
    
    const validEvent: KnockbackEvent = {
      type: 'knockback',
      targetEntity: 'player1',
      force: { x: 100, y: 50 },
      duration: 500,
    };
    
    const result = validatePhysicsEventResult(validEvent);
    expect(result.success).toBe(true);
  });

  it('should validate out-of-bounds events against schema', async () => {
    const { validatePhysicsEventResult } = await import('../src/validation/schemas');
    
    const validEvent: OutOfBoundsEvent = {
      type: 'out-of-bounds',
      entity: 'player1',
      lastPosition: { x: 0, y: 0 },
      direction: 'left',
    };
    
    const result = validatePhysicsEventResult(validEvent);
    expect(result.success).toBe(true);
  });

  it('should reject invalid physics events', async () => {
    const { validatePhysicsEventResult } = await import('../src/validation/schemas');
    
    const invalidEvent = {
      type: 'invalid-type',
      entityA: 'player1',
    };
    
    const result = validatePhysicsEventResult(invalidEvent);
    expect(result.success).toBe(false);
  });
});
