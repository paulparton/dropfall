import { describe, expect, it } from 'vitest';
import {
  interpolateNetworkState,
  NetworkStateBuffer,
} from '../src/network/NetworkStateBuffer.js';
import { OnlineManager } from '../src/online.js';

function stateAt(x: number) {
  return {
    p1Pos: { x, y: 2, z: 0 },
    p1Vel: { x: 100, y: 0, z: 0 },
    p2Pos: { x: -x, y: 2, z: 0 },
    p2Vel: { x: -100, y: 0, z: 0 },
  };
}

describe('network snapshot smoothing', () => {
  it('interpolates vectors without mutating authoritative snapshots', () => {
    const from = stateAt(0);
    const to = stateAt(10);
    const result = interpolateNetworkState(from, to, 0.25);

    expect(result.p1Pos).toEqual({ x: 2.5, y: 2, z: 0 });
    expect(result.p2Pos).toEqual({ x: -2.5, y: 2, z: 0 });
    expect(from.p1Pos.x).toBe(0);
    expect(to.p1Pos.x).toBe(10);
  });

  it('renders a steady server timeline despite irregular packet arrival', () => {
    const buffer = new NetworkStateBuffer({ interpolationDelayMs: 100 });
    buffer.push({ tick: 0, serverTime: 1000, receivedAt: 2000, state: stateAt(0) });
    buffer.push({ tick: 3, serverTime: 1050, receivedAt: 2075, state: stateAt(5) });
    buffer.push({ tick: 6, serverTime: 1100, receivedAt: 2120, state: stateAt(10) });

    const sample = buffer.sample(2175);
    expect(sample?.mode).toBe('interpolated');
    expect(sample?.state.p1Pos.x).toBeGreaterThan(7);
    expect(sample?.state.p1Pos.x).toBeLessThan(8);
  });

  it('caps extrapolation when the newest packet is late', () => {
    const buffer = new NetworkStateBuffer({
      interpolationDelayMs: 0,
      maxExtrapolationMs: 75,
    });
    buffer.push({ tick: 12, serverTime: 1000, receivedAt: 2000, state: stateAt(0) });

    const sample = buffer.sample(2300);
    expect(sample?.mode).toBe('extrapolated');
    expect(sample?.state.p1Pos.x).toBeCloseTo(7.5, 5);
  });
});

describe('online input pacing', () => {
  it('sends changes quickly while limiting unchanged input to 20 Hz', () => {
    const manager = new OnlineManager();
    manager.lastInputSentAt = 100;
    manager.lastInputSignature = '0:0:0';

    expect(manager.shouldSendInput({ forward: false }, 120)).toBe(false);
    expect(manager.shouldSendInput({ forward: false }, 151)).toBe(true);
    expect(manager.shouldSendInput({ forward: true }, 112)).toBe(true);
  });
});
