import { describe, it, expect, beforeEach, vi } from 'vitest';

// These tests exercise the real useGameStore (not the hand-rolled mock in
// store.test.js) for the new per-player "Use Stage Skin" flag.
//
// vitest module isolation + localStorage.clear() before each import guarantees
// the persisted-default path is exercised deterministically.

describe('stage-skin flag — store persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('defaults p1UseStageSkin / p2UseStageSkin to true when no stored value', async () => {
    const { useGameStore } = await import('../src/store.js');
    const s = useGameStore.getState();
    expect(s.p1UseStageSkin).toBe(true);
    expect(s.p2UseStageSkin).toBe(true);
  });

  it('reads persisted false from localStorage and respects it', async () => {
    localStorage.setItem('dropfall_p1stagekin', 'false');
    const { useGameStore } = await import('../src/store.js');
    const s = useGameStore.getState();
    expect(s.p1UseStageSkin).toBe(false);
    // P2 default still true when only p1 stored value exists.
    expect(s.p2UseStageSkin).toBe(true);
  });

  it('exposes a setPlayerStageSkins action', async () => {
    const { useGameStore } = await import('../src/store.js');
    expect(typeof useGameStore.getState().setPlayerStageSkins).toBe('function');
  });

  it('setPlayerStageSkins updates state AND writes raw string to localStorage keys', async () => {
    const { useGameStore } = await import('../src/store.js');
    useGameStore.getState().setPlayerStageSkins(false, true);
    expect(useGameStore.getState().p1UseStageSkin).toBe(false);
    expect(useGameStore.getState().p2UseStageSkin).toBe(true);
    expect(localStorage.getItem('dropfall_p1stagekin')).toBe('false');
    expect(localStorage.getItem('dropfall_p2stagekin')).toBe('true');
  });

  it('setPlayerStageSkins round-trips true -> persisted true', async () => {
    const { useGameStore } = await import('../src/store.js');
    useGameStore.getState().setPlayerStageSkins(true, false);
    expect(localStorage.getItem('dropfall_p1stagekin')).toBe('true');
    expect(localStorage.getItem('dropfall_p2stagekin')).toBe('false');
  });

  it('survives reload: a fresh store import reads back a previously-written value', async () => {
    const first = await import('../src/store.js');
    first.useGameStore.getState().setPlayerStageSkins(false, true);
    // Simulate a page reload by clearing the module cache and re-importing.
    vi.resetModules();
    const second = await import('../src/store.js');
    expect(second.useGameStore.getState().p1UseStageSkin).toBe(false);
    expect(second.useGameStore.getState().p2UseStageSkin).toBe(true);
  });
});