import { describe, expect, it, vi } from 'vitest';
import { POWER_UP_EFFECTS } from '../src/entities/Player.js';
import { ServerPlayer } from '../server/game/Player.js';

describe('Floaty power-up gravity', () => {
  it('sets a stable client gravity scale instead of accumulating upward force', () => {
    const setGravityScale = vi.fn();
    const addForce = vi.fn();
    const player = {
      gravityMultiplier: 1,
      rigidBody: { setGravityScale, addForce },
      themeAwarePowerUpColors: {},
      powerUpColor: null,
    };
    const floaty = POWER_UP_EFFECTS.find((effect) => effect.type === 'LIGHT_TOUCH');

    floaty?.apply(player as never);
    expect(setGravityScale).toHaveBeenCalledWith(0.5, true);
    expect(addForce).not.toHaveBeenCalled();

    floaty?.remove(player as never);
    expect(setGravityScale).toHaveBeenLastCalledWith(1, true);
  });

  it('restores authoritative server gravity when Floaty expires', () => {
    const setGravityScale = vi.fn();
    const player = Object.assign(Object.create(ServerPlayer.prototype), {
      settings: { bonusDuration: 4 },
      sphereWeight: 200,
      gravityMultiplier: 1,
      accelMultiplier: 1,
      activePowerUps: [],
      body: { setGravityScale, linvel: () => ({ x: 0, y: 0, z: 0 }), applyImpulse: vi.fn() },
      collider: { setMass: vi.fn(), setFriction: vi.fn() },
    });

    player._applyPowerUp('LIGHT_TOUCH');
    expect(setGravityScale).toHaveBeenCalledWith(0.5, true);

    player._updatePowerUps(5);
    expect(setGravityScale).toHaveBeenLastCalledWith(1, true);
  });
});
