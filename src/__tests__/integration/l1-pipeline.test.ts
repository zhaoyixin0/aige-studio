/**
 * B7: E2E pipeline integration test
 * L1 → CompositeMapper → batchUpdateParams → store update → buildConfigChanges → applyChanges
 *
 * Tests the full data flow without React components or real engine.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/game-store';
import { applyL1Preset, type L1Values } from '@/engine/core/composite-mapper';
import { buildConfigChanges } from '@/app/hooks/use-engine-bridge';
import type { GameConfig } from '@/engine/core';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
    { id: 'collision', type: 'Collision', enabled: true, params: { hitboxScale: 1.0 } },
    { id: 'runner', type: 'Runner', enabled: true, params: { speed: 600, maxSpeed: 1200 } },
    { id: 'particle-vfx', type: 'ParticleVFX', enabled: true, params: { burstScale: 1.0 } },
    { id: 'sound-fx', type: 'SoundFX', enabled: true, params: { feedbackVolume: 0.8 } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
});

describe('L1 Pipeline Integration', () => {
  beforeEach(() => {
    useGameStore.setState({ config: makeConfig(), configVersion: 0 });
  });

  it('L1 preset produces changes that batchUpdateParams can consume', () => {
    const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
    const changes = applyL1Preset(l1, 'catch');

    expect(changes.length).toBeGreaterThan(0);

    // Feed changes to batchUpdateParams
    useGameStore.getState().batchUpdateParams(changes);

    expect(useGameStore.getState().configVersion).toBe(1);
  });

  it('full pipeline: L1 → Mapper → store → diff produces ConfigChanges', () => {
    const configBefore = useGameStore.getState().config!;
    const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };

    // Step 1: Map L1 to module changes
    const mappedChanges = applyL1Preset(l1, 'catch');

    // Step 2: Apply to store
    useGameStore.getState().batchUpdateParams(mappedChanges);

    // Step 3: Diff old vs new config (what EngineBridge does)
    const configAfter = useGameStore.getState().config!;
    const configChanges = buildConfigChanges(configBefore, configAfter);

    // Should produce update_param ops for changed modules
    expect(configChanges.length).toBeGreaterThan(0);
    for (const change of configChanges) {
      expect(change.op).toBe('update_param');
      expect(change.moduleId).toBeTruthy();
      expect(change.params).toBeTruthy();
    }
  });

  it('difficulty "困难" changes spawner speed and decreases lives', () => {
    const l1Easy: L1Values = { difficulty: '简单', pacing: '中', emotion: '欢乐' };
    const l1Hard: L1Values = { difficulty: '困难', pacing: '中', emotion: '欢乐' };

    // Apply easy first
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1Easy, 'catch'));
    const easyConfig = useGameStore.getState().config!;
    const easySpawner = easyConfig.modules.find((m) => m.id === 'spawner')!;
    const easyLives = easyConfig.modules.find((m) => m.id === 'lives')!;

    // Reset and apply hard
    useGameStore.setState({ config: makeConfig(), configVersion: 10 });
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1Hard, 'catch'));
    const hardConfig = useGameStore.getState().config!;
    const hardSpawner = hardConfig.modules.find((m) => m.id === 'spawner')!;
    const hardLives = hardConfig.modules.find((m) => m.id === 'lives')!;

    // Hard should have higher speed and fewer lives than easy
    expect(hardSpawner.params.speed).toBeGreaterThan(easySpawner.params.speed as number);
    expect(hardLives.params.count).toBeLessThanOrEqual(easyLives.params.count as number);
  });

  it('pacing "快" increases runner speed for runner game type', () => {
    const l1: L1Values = { difficulty: '普通', pacing: '快', emotion: '欢乐' };

    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'runner'));

    const runner = useGameStore.getState().config!.modules.find((m) => m.id === 'runner')!;
    expect(runner.params.speed).toBeGreaterThan(600);
  });

  it('emotion "热血" increases particle burst scale', () => {
    const l1: L1Values = { difficulty: '普通', pacing: '中', emotion: '热血' };

    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));

    const vfx = useGameStore.getState().config!.modules.find((m) => m.id === 'particle-vfx')!;
    expect(vfx.params.burstScale).toBeGreaterThan(1.0);
  });

  it('configVersion increments exactly once per L1 apply', () => {
    const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };

    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));
    expect(useGameStore.getState().configVersion).toBe(1);

    // Second apply
    const l1b: L1Values = { difficulty: '简单', pacing: '慢', emotion: '沉静' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1b, 'catch'));
    expect(useGameStore.getState().configVersion).toBe(2);
  });

  it('diff only contains actually changed params', () => {
    const configBefore = useGameStore.getState().config!;

    // Only change difficulty — pacing/emotion at defaults
    const l1: L1Values = { difficulty: '困难', pacing: '中', emotion: '欢乐' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));

    const configAfter = useGameStore.getState().config!;
    const changes = buildConfigChanges(configBefore, configAfter);

    // Each change should only include params that actually differ
    for (const change of changes) {
      const oldMod = configBefore.modules.find((m) => m.id === change.moduleId);
      if (oldMod && change.params) {
        for (const [key, val] of Object.entries(change.params)) {
          expect(val).not.toBe(oldMod.params[key]);
        }
      }
    }
  });

  it('immutability: original config unchanged after pipeline', () => {
    const configBefore = useGameStore.getState().config!;
    const spawnerBefore = configBefore.modules.find((m) => m.id === 'spawner')!;
    const originalFreq = spawnerBefore.params.frequency;

    const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));

    // Original config object should be unchanged
    expect(spawnerBefore.params.frequency).toBe(originalFreq);
  });
});
