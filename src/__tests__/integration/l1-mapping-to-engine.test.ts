/**
 * B11: Integration test — L1 mapping to live engine
 *
 * Full pipeline: L1Values → CompositeMapper → ConfigChange[] → ConfigLoader.applyChanges → Engine
 * Verifies that L1 adjustments actually change running module parameters.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { applyL1Preset, type L1Values } from '@/engine/core/composite-mapper';
import { buildConfigChanges } from '@/app/hooks/use-engine-bridge';
import { useGameStore } from '@/store/game-store';
import type { GameConfig } from '@/engine/core';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
    { id: 'collision', type: 'Collision', enabled: true, params: { hitboxScale: 1.0 } },
    { id: 'timer', type: 'Timer', enabled: true, params: { duration: 30 } },
    { id: 'particle-vfx', type: 'ParticleVFX', enabled: true, params: { burstScale: 1.0 } },
    { id: 'sound-fx', type: 'SoundFX', enabled: true, params: { feedbackVolume: 0.8 } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
});

describe('L1 mapping to engine integration', () => {
  let engine: Engine;
  let loader: ConfigLoader;

  beforeEach(() => {
    engine = new Engine();
    const registry = createModuleRegistry();
    loader = new ConfigLoader(registry);

    const config = makeConfig();
    loader.load(engine, config);
    engine.start();

    useGameStore.setState({ config, configVersion: 0 });
  });

  it('full pipeline: L1 "困难" → engine spawner gets higher frequency', () => {
    const configBefore = useGameStore.getState().config!;

    // Step 1: L1 → mapped changes
    const l1: L1Values = { difficulty: '困难', pacing: '中', emotion: '欢乐' };
    const mappedChanges = applyL1Preset(l1, 'catch');

    // Step 2: Apply to store
    useGameStore.getState().batchUpdateParams(mappedChanges);
    const configAfter = useGameStore.getState().config!;

    // Step 3: Diff → ConfigChange[]
    const configChanges = buildConfigChanges(configBefore, configAfter);

    // Step 4: Apply to engine
    loader.applyChanges(engine, configChanges);

    // Verify engine module received the update
    const spawner = engine.getModule('spawner')!;
    expect(spawner.getParams().speed).toBeGreaterThan(200);
  });

  it('full pipeline: L1 emotion "热血" → engine particle burstScale increased', () => {
    const configBefore = useGameStore.getState().config!;

    const l1: L1Values = { difficulty: '普通', pacing: '中', emotion: '热血' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));
    const configAfter = useGameStore.getState().config!;

    const configChanges = buildConfigChanges(configBefore, configAfter);
    loader.applyChanges(engine, configChanges);

    const vfx = engine.getModule('particle-vfx')!;
    expect(vfx.getParams().burstScale).toBe(1.5);
  });

  it('full pipeline: L1 emotion "热血" → engine sound feedbackVolume increased', () => {
    const configBefore = useGameStore.getState().config!;

    const l1: L1Values = { difficulty: '普通', pacing: '中', emotion: '热血' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));
    const configAfter = useGameStore.getState().config!;

    const configChanges = buildConfigChanges(configBefore, configAfter);
    loader.applyChanges(engine, configChanges);

    const sfx = engine.getModule('sound-fx')!;
    expect(sfx.getParams().feedbackVolume).toBe(1.0);
  });

  it('applying two sequential L1 changes both reach engine', () => {
    let configBefore = useGameStore.getState().config!;

    // First: easy
    const easy: L1Values = { difficulty: '简单', pacing: '慢', emotion: '沉静' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(easy, 'catch'));
    let configAfter = useGameStore.getState().config!;
    loader.applyChanges(engine, buildConfigChanges(configBefore, configAfter));

    const easySpeed = engine.getModule('spawner')!.getParams().speed as number;

    // Second: hard
    configBefore = useGameStore.getState().config!;
    const hard: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(hard, 'catch'));
    configAfter = useGameStore.getState().config!;
    loader.applyChanges(engine, buildConfigChanges(configBefore, configAfter));

    const hardSpeed = engine.getModule('spawner')!.getParams().speed as number;
    expect(hardSpeed).toBeGreaterThan(easySpeed);
  });

  it('engine remains stable after L1 pipeline (can tick)', () => {
    const configBefore = useGameStore.getState().config!;

    const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
    useGameStore.getState().batchUpdateParams(applyL1Preset(l1, 'catch'));
    const configAfter = useGameStore.getState().config!;

    loader.applyChanges(engine, buildConfigChanges(configBefore, configAfter));

    // Engine should still be runnable
    expect(() => {
      engine.tick(16);
      engine.tick(16);
      engine.tick(16);
    }).not.toThrow();
  });
});
