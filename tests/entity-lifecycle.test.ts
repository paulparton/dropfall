import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EntityBase, EntityEventEmitter } from '../src/entities/Entity.base';
import type { GameContext } from '../src/types/Entity';

describe('EntityBase', () => {
  class TestEntity extends EntityBase {
    async initialize(): Promise<void> {
      const context: GameContext = { deltaTime: 0, gameState: {}, physics: null, audio: null };
      await super.initialize(context);
    }
  }
  
  it('should start in created state', () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    expect(entity.state).toBe('created');
  });
  
  it('should transition to ready on initialize', async () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    await entity.initialize();
    expect(entity.state).toBe('ready');
  });
  
  it('should transition to active on first update', async () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    await entity.initialize();
    const context: GameContext = { deltaTime: 0.016, gameState: {}, physics: null, audio: null };
    entity.update(0.016, context);
    expect(entity.state).toBe('active');
  });
  
  it('should emit spawn event on initialize', async () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    const emitSpy = vi.spyOn(entity.events, 'emit');
    await entity.initialize();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'spawn' })
    );
  });
  
  it('should emit destroy event on destroy', async () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    const emitSpy = vi.spyOn(entity.events, 'emit');
    await entity.destroy();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'destroy' })
    );
  });

  it('should have correct id and type', () => {
    const entity = new TestEntity('test-entity', 'arena', { x: 5, y: 10 });
    expect(entity.id).toBe('test-entity');
    expect(entity.type).toBe('arena');
  });

  it('should have initial position', () => {
    const entity = new TestEntity('test', 'particle', { x: 3, y: 7 });
    expect(entity.position.x).toBe(3);
    expect(entity.position.y).toBe(7);
  });

  it('should support metadata', () => {
    const entity = new TestEntity('test', 'player', { x: 0, y: 0 });
    entity.metadata.customData = 'test-value';
    expect(entity.metadata.customData).toBe('test-value');
  });
});

describe('EntityEventEmitter', () => {
  it('should register and call listeners', () => {
    const emitter = new EntityEventEmitter();
    const handler = vi.fn();
    
    emitter.on('collision', handler);
    emitter.emit({ type: 'collision', entityId: 'test', timestamp: Date.now() });
    
    expect(handler).toHaveBeenCalledTimes(1);
  });
  
  it('should remove listeners', () => {
    const emitter = new EntityEventEmitter();
    const handler = vi.fn();
    
    emitter.on('collision', handler);
    emitter.off('collision', handler);
    emitter.emit({ type: 'collision', entityId: 'test', timestamp: Date.now() });
    
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple event types', () => {
    const emitter = new EntityEventEmitter();
    const collisionHandler = vi.fn();
    const deathHandler = vi.fn();
    
    emitter.on('collision', collisionHandler);
    emitter.on('death', deathHandler);
    
    emitter.emit({ type: 'collision', entityId: 'test', timestamp: Date.now() });
    expect(collisionHandler).toHaveBeenCalledTimes(1);
    expect(deathHandler).not.toHaveBeenCalled();
    
    emitter.emit({ type: 'death', entityId: 'test', timestamp: Date.now() });
    expect(deathHandler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple listeners per event', () => {
    const emitter = new EntityEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    emitter.on('spawn', handler1);
    emitter.on('spawn', handler2);
    emitter.emit({ type: 'spawn', entityId: 'test', timestamp: Date.now() });
    
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should clear all listeners', () => {
    const emitter = new EntityEventEmitter();
    const handler = vi.fn();
    
    emitter.on('collision', handler);
    emitter.clear();
    emitter.emit({ type: 'collision', entityId: 'test', timestamp: Date.now() });
    
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return listener count', () => {
    const emitter = new EntityEventEmitter();
    const handler = vi.fn();
    
    expect(emitter.listenerCount('collision')).toBe(0);
    emitter.on('collision', handler);
    expect(emitter.listenerCount('collision')).toBe(1);
  });
});
