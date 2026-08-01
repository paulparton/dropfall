import { describe, expect, it, vi } from 'vitest';
import {
  POWER_UP_DEFINITIONS,
  POWER_UP_TYPES,
  getPowerUpDefinition,
} from '../shared/powerUps.js';
import { POWER_UP_EFFECTS } from '../src/entities/Player.js';
import { ServerPlayer } from '../server/game/Player.js';

describe('canonical power-up contract', () => {
  it('has a unique authored icon and client effect for every shared type', () => {
    expect(new Set(POWER_UP_TYPES).size).toBe(POWER_UP_TYPES.length);
    expect(new Set(POWER_UP_DEFINITIONS.map(definition => definition.iconPath)).size)
      .toBe(POWER_UP_DEFINITIONS.length);
    expect(POWER_UP_EFFECTS.map(effect => effect.type)).toEqual(POWER_UP_TYPES);

    for (const definition of POWER_UP_DEFINITIONS) {
      expect(definition.iconPath).toMatch(/^\/assets\/powerups\/[a-z-]+\.svg$/);
      expect(definition.description.length).toBeGreaterThan(20);
      expect(getPowerUpDefinition(definition.type)).toBe(definition);
    }
  });

  it('uses the same movement modifiers on the client and authoritative server', () => {
    const speed = getPowerUpDefinition('ACCELERATION_BOOST');
    const floaty = getPowerUpDefinition('LIGHT_TOUCH');
    const grip = getPowerUpDefinition('GRIP_BOOST');
    const speedModifiers = speed?.modifiers as { acceleration: number };
    const floatyModifiers = floaty?.modifiers as { gravity: number };
    const gripModifiers = grip?.modifiers as { friction: number };
    expect(speedModifiers.acceleration).toBe(2);
    expect(floatyModifiers.gravity).toBe(0.5);
    expect(gripModifiers.friction).toBe(3);

    const setGravityScale = vi.fn();
    const setFriction = vi.fn();
    const player = Object.assign(Object.create(ServerPlayer.prototype), {
      settings: { bonusDuration: 4 },
      sphereWeight: 200,
      gravityMultiplier: 1,
      accelMultiplier: 1,
      activePowerUps: [],
      body: {
        setGravityScale,
        linvel: () => ({ x: 0, y: 0, z: 0 }),
        applyImpulse: vi.fn(),
      },
      collider: { setMass: vi.fn(), setFriction },
    });

    player._applyPowerUp('ACCELERATION_BOOST');
    player._applyPowerUp('LIGHT_TOUCH');
    player._applyPowerUp('GRIP_BOOST');

    expect(player.accelMultiplier).toBe(speedModifiers.acceleration);
    expect(setGravityScale).toHaveBeenLastCalledWith(floatyModifiers.gravity, true);
    expect(setFriction).toHaveBeenLastCalledWith(1.5);
  });

  it('treats Rocket Boost as an instant effect instead of a timed status', () => {
    const applyImpulse = vi.fn();
    const player = Object.assign(Object.create(ServerPlayer.prototype), {
      settings: { bonusDuration: 4 },
      sphereWeight: 200,
      activePowerUps: [],
      body: {
        linvel: () => ({ x: 3, y: 0, z: 4 }),
        applyImpulse,
      },
    });

    player._applyPowerUp('SPEED_BURST');

    expect(player.activePowerUps).toEqual([]);
    expect(applyImpulse).toHaveBeenCalledWith({ x: 30, y: 0, z: 40 }, true);
  });
});
