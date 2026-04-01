import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../game-store';
import type { GameConfig } from '@/engine/core';

const MINIMAL_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
  canvas: { width: 800, height: 600 },
  modules: [
    { id: 'timer-1', type: 'Timer', enabled: true, params: { duration: 30 } },
    { id: 'scorer-1', type: 'Scorer', enabled: true, params: { hitEvent: 'collision:hit' } },
  ],
  assets: {},
};

describe('GameStore configVersion', () => {
  beforeEach(() => {
    useGameStore.setState({ config: null, configVersion: 0 });
  });

  it('configVersion should exist and start at 0', () => {
    const state = useGameStore.getState();
    expect(state.configVersion).toBe(0);
  });

  it('setConfig should increment configVersion', () => {
    const store = useGameStore.getState();
    store.setConfig(MINIMAL_CONFIG);
    expect(useGameStore.getState().configVersion).toBe(1);

    store.setConfig({ ...MINIMAL_CONFIG, version: '2.0.0' });
    expect(useGameStore.getState().configVersion).toBe(2);
  });

  it('updateModuleParam should increment configVersion', () => {
    const store = useGameStore.getState();
    store.setConfig(MINIMAL_CONFIG);
    const v1 = useGameStore.getState().configVersion;

    store.updateModuleParam('timer-1', 'duration', 60);
    const v2 = useGameStore.getState().configVersion;

    expect(v2).toBeGreaterThan(v1);
  });

  it('addModule should increment configVersion', () => {
    const store = useGameStore.getState();
    store.setConfig(MINIMAL_CONFIG);
    const v1 = useGameStore.getState().configVersion;

    store.addModule({ id: 'lives-1', type: 'Lives', enabled: true, params: { count: 3 } });
    expect(useGameStore.getState().configVersion).toBeGreaterThan(v1);
  });

  it('toggleModule should increment configVersion', () => {
    const store = useGameStore.getState();
    store.setConfig(MINIMAL_CONFIG);
    const v1 = useGameStore.getState().configVersion;

    store.toggleModule('timer-1');
    expect(useGameStore.getState().configVersion).toBeGreaterThan(v1);
  });
});
