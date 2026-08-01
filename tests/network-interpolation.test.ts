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

describe('render clock stability', () => {
  it('does not jump the render timeline when one packet arrives early', () => {
    const buffer = new NetworkStateBuffer({ interpolationDelayMs: 100 });

    // Steady stream at 50ms intervals with a 200ms transit time.
    for (let i = 0; i < 20; i += 1) {
      buffer.push({
        tick: i,
        serverTime: 1000 + i * 50,
        receivedAt: 1200 + i * 50,
        state: stateAt(i),
      });
    }
    const settledOffset = buffer.clockOffsetMs;
    expect(settledOffset).toBeCloseTo(200, 0);

    // One packet takes a much faster route.
    buffer.push({ tick: 20, serverTime: 2000, receivedAt: 2080, state: stateAt(20) });

    // The estimate moves toward the new minimum, but by a slew small enough
    // that the opponent never visibly teleports.
    expect(buffer.clockOffsetMs).toBeLessThan(settledOffset!);
    expect(settledOffset! - buffer.clockOffsetMs!).toBeLessThanOrEqual(1);
  });

  it('resyncs outright when the connection genuinely shifts', () => {
    const buffer = new NetworkStateBuffer({ interpolationDelayMs: 100 });
    buffer.push({ tick: 0, serverTime: 1000, receivedAt: 1800, state: stateAt(0) });
    expect(buffer.clockOffsetMs).toBe(800);

    buffer.push({ tick: 1, serverTime: 1050, receivedAt: 1100, state: stateAt(1) });
    expect(buffer.clockOffsetMs).toBe(50);
  });

  it('widens the interpolation delay on a jittery link and keeps it bounded', () => {
    const steady = new NetworkStateBuffer();
    const jittery = new NetworkStateBuffer();

    for (let i = 0; i < 120; i += 1) {
      const serverTime = 1000 + i * 33;
      steady.push({ tick: i, serverTime, receivedAt: serverTime + 60, state: stateAt(i) });
      jittery.push({
        tick: i,
        serverTime,
        receivedAt: serverTime + 60 + (i % 2 === 0 ? 0 : 70),
        state: stateAt(i),
      });
    }

    expect(jittery.interpolationDelayMs).toBeGreaterThan(steady.interpolationDelayMs);
    expect(steady.interpolationDelayMs).toBeGreaterThanOrEqual(steady.minDelayMs);
    expect(jittery.interpolationDelayMs).toBeLessThanOrEqual(jittery.maxDelayMs);
  });

  it('keeps the clock estimate when snapshots are dropped between rounds', () => {
    const buffer = new NetworkStateBuffer({ interpolationDelayMs: 100 });
    buffer.push({ tick: 5, serverTime: 1000, receivedAt: 1150, state: stateAt(0) });

    buffer.clearSnapshots();

    expect(buffer.snapshots).toHaveLength(0);
    expect(buffer.clockOffsetMs).toBe(150);
    expect(buffer.sample(1200)).toBeNull();
  });

  it('replaces a resent snapshot rather than stacking it, across round resets', () => {
    const buffer = new NetworkStateBuffer({ interpolationDelayMs: 100 });
    buffer.push({ tick: 400, serverTime: 1000, receivedAt: 1100, state: stateAt(0) });
    buffer.push({ tick: 1, serverTime: 1000, receivedAt: 1100, state: stateAt(9) });

    expect(buffer.snapshots).toHaveLength(1);
    expect(buffer.snapshots[0].state.p1Pos.x).toBe(9);
  });
});

describe('latency estimation', () => {
  it('tracks the fastest recent round trip and halves it for one-way lag', () => {
    const manager = new OnlineManager();

    expect(manager.getLatencyMs()).toBe(40);

    manager.recordPong(1000, 1120);
    expect(manager.rttMs).toBe(120);
    expect(manager.getLatencyMs()).toBe(60);

    // A single slow reply is queueing, not the link getting worse.
    manager.recordPong(2000, 2400);
    expect(manager.rttMs).toBe(120);
  });

  it('ignores impossible round trips', () => {
    const manager = new OnlineManager();
    manager.recordPong(2000, 1000);
    manager.recordPong(1000, 90000);
    expect(manager.rttMs).toBeNull();
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
