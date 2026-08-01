import { describe, expect, it, vi } from 'vitest';
import { Arena } from '../src/entities/Arena.js';

function makeTile(q: number, state: string) {
  return {
    q,
    r: 0,
    state,
    timer: 5,
    powerUpType: state === 'BONUS' ? 'SPEED_BURST' : null,
    statue: null,
    statuePowerUp: null,
    collider: { setFriction: vi.fn() },
    rigidBody: { setBodyType: vi.fn() },
    mesh: {
      position: { x: 0, y: 0, z: 0 },
      visible: true,
      scale: { set: vi.fn() },
    },
    edges: {
      visible: true,
      material: { color: { setHex: vi.fn() } },
    },
    uniforms: { uState: { value: -1 } },
  };
}

describe('authoritative sparse tile synchronization', () => {
  it('clears transient tiles omitted from a complete server snapshot', () => {
    const ice = makeTile(0, 'ICE');
    const bonus = makeTile(1, 'BONUS');
    const arena: any = Object.create(Arena.prototype);
    arena.tiles = [ice, bonus];
    arena.edgeColor = 0xffffff;

    arena.applyAuthoritativeTileStates([]);

    expect(ice.state).toBe('NORMAL');
    expect(bonus.state).toBe('NORMAL');
    expect(bonus.powerUpType).toBeNull();
    expect(ice.collider.setFriction).toHaveBeenLastCalledWith(0.5);
  });

  it('applies ice and falling transitions through physics presentation hooks', () => {
    const ice = makeTile(0, 'NORMAL');
    const falling = makeTile(1, 'WARNING');
    const arena: any = Object.create(Arena.prototype);
    arena.tiles = [ice, falling];
    arena.edgeColor = 0xffffff;

    arena.applyAuthoritativeTileStates([
      { q: 0, r: 0, state: 'ICE', timer: 4 },
      { q: 1, r: 0, state: 'FALLING', timer: 0 },
    ]);

    expect(ice.state).toBe('ICE');
    expect(ice.collider.setFriction).toHaveBeenLastCalledWith(0);
    expect(falling.state).toBe('FALLING');
    expect(falling.mesh.visible).toBe(false);
    expect(falling.edges.visible).toBe(false);
  });
});
