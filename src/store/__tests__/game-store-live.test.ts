import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '@/store/game-store';
import type { GameConfig } from '@/engine/core';

const baseConfig: GameConfig = {
  meta: {
    name: 'test',
    theme: 'fruit',
    artStyle: 'cartoon',
    inputMethod: 'TouchInput',
  },
  modules: [
    { id: 'mod_1', type: 'Spawner', enabled: true, params: { speed: 3 } },
    { id: 'mod_2', type: 'Scorer', enabled: true, params: { baseScore: 10 } },
  ],
  assets: {},
} as unknown as GameConfig;

// Capture RAF callbacks so tests can flush them manually
let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  // Drain any leftover RAF callbacks from the module-level liveScheduled flag.
  // Use the real requestAnimationFrame stub from previous test (if any) to flush
  // accumulator before installing a fresh stub.
  const leftover = [...rafCallbacks];
  rafCallbacks = [];
  leftover.forEach((cb) => cb(0));

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return 0;
  });

  // Reset store to a clean state with a known config
  useGameStore.setState({ config: baseConfig, configVersion: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushRaf(): void {
  const cbs = [...rafCallbacks];
  rafCallbacks = [];
  cbs.forEach((cb) => cb(0));
}

describe('updateModuleParamLive — RAF micro-batching', () => {
  it('applies params to store after RAF flush', () => {
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 5);
    useGameStore.getState().updateModuleParamLive('mod_1', 'interval', 1.5);
    useGameStore.getState().updateModuleParamLive('mod_1', 'count', 4);

    // Params should NOT be applied yet
    const before = useGameStore.getState().config!.modules.find((m) => m.id === 'mod_1')!;
    expect(before.params.speed).toBe(3); // original value

    flushRaf();

    const after = useGameStore.getState().config!.modules.find((m) => m.id === 'mod_1')!;
    expect(after.params.speed).toBe(5);
    expect(after.params.interval).toBe(1.5);
    expect(after.params.count).toBe(4);
  });

  it('merges multiple updates to same param — last value wins', () => {
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 5);
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 8);
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 10);

    flushRaf();

    const mod1 = useGameStore.getState().config!.modules.find((m) => m.id === 'mod_1')!;
    expect(mod1.params.speed).toBe(10);
  });

  it('handles multiple modules — both updated in single flush', () => {
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 7);
    useGameStore.getState().updateModuleParamLive('mod_2', 'baseScore', 20);

    flushRaf();

    const config = useGameStore.getState().config!;
    const mod1 = config.modules.find((m) => m.id === 'mod_1')!;
    const mod2 = config.modules.find((m) => m.id === 'mod_2')!;

    expect(mod1.params.speed).toBe(7);
    expect(mod2.params.baseScore).toBe(20);
  });

  it('schedules only one RAF callback when called multiple times in same frame', () => {
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 1);
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 2);
    useGameStore.getState().updateModuleParamLive('mod_2', 'baseScore', 5);

    expect(rafCallbacks).toHaveLength(1);
  });

  it('configVersion bumps exactly once per frame for 3 updates', () => {
    const versionBefore = useGameStore.getState().configVersion;

    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 1);
    useGameStore.getState().updateModuleParamLive('mod_1', 'interval', 2);
    useGameStore.getState().updateModuleParamLive('mod_2', 'baseScore', 5);

    flushRaf();

    const versionAfter = useGameStore.getState().configVersion;
    expect(versionAfter).toBe(versionBefore + 1);
  });

  it('allows a second RAF batch after first flush', () => {
    const v0 = useGameStore.getState().configVersion;

    // First frame
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 1);
    flushRaf();

    expect(useGameStore.getState().configVersion).toBe(v0 + 1);

    // Second frame — a new RAF should be schedulable
    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 2);
    expect(rafCallbacks).toHaveLength(1);
    flushRaf();

    const mod1 = useGameStore.getState().config!.modules.find((m) => m.id === 'mod_1')!;
    expect(mod1.params.speed).toBe(2);
    expect(useGameStore.getState().configVersion).toBe(v0 + 2);
  });

  it('does not modify store before RAF fires', () => {
    const versionBefore = useGameStore.getState().configVersion;

    useGameStore.getState().updateModuleParamLive('mod_1', 'speed', 99);

    // RAF has not fired yet
    expect(useGameStore.getState().configVersion).toBe(versionBefore);
    const mod1 = useGameStore.getState().config!.modules.find((m) => m.id === 'mod_1')!;
    expect(mod1.params.speed).toBe(3); // original
  });
});
