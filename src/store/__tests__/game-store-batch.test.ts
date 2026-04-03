import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../game-store';
import type { GameConfig } from '@/engine/core';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
});

describe('game-store batchUpdateParams', () => {
  beforeEach(() => {
    useGameStore.setState({ config: makeConfig(), configVersion: 0 });
  });

  it('batchUpdateParams exists as a function', () => {
    expect(typeof useGameStore.getState().batchUpdateParams).toBe('function');
  });

  it('updates multiple modules in a single call', () => {
    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 2, speed: 400 } },
      { moduleId: 'scorer', changes: { perHit: 20 } },
    ]);

    const config = useGameStore.getState().config!;
    const spawner = config.modules.find((m) => m.id === 'spawner')!;
    const scorer = config.modules.find((m) => m.id === 'scorer')!;

    expect(spawner.params.frequency).toBe(2);
    expect(spawner.params.speed).toBe(400);
    expect(scorer.params.perHit).toBe(20);
  });

  it('increments configVersion exactly once per batch', () => {
    const vBefore = useGameStore.getState().configVersion;

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 5 } },
      { moduleId: 'scorer', changes: { perHit: 50 } },
      { moduleId: 'lives', changes: { count: 5 } },
    ]);

    expect(useGameStore.getState().configVersion).toBe(vBefore + 1);
  });

  it('preserves existing params not in updates', () => {
    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 10 } },
    ]);

    const spawner = useGameStore.getState().config!.modules.find((m) => m.id === 'spawner')!;
    expect(spawner.params.frequency).toBe(10);
    expect(spawner.params.speed).toBe(200); // unchanged
  });

  it('ignores updates for non-existent modules', () => {
    const vBefore = useGameStore.getState().configVersion;

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'nonexistent', changes: { foo: 1 } },
    ]);

    // Still increments version (batch was processed)
    expect(useGameStore.getState().configVersion).toBe(vBefore + 1);
  });

  it('returns immutable state (no mutation)', () => {
    const configBefore = useGameStore.getState().config!;
    const modulesBefore = configBefore.modules;

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 99 } },
    ]);

    const configAfter = useGameStore.getState().config!;
    expect(configAfter).not.toBe(configBefore);
    expect(configAfter.modules).not.toBe(modulesBefore);
    // Original unchanged
    expect(modulesBefore.find((m) => m.id === 'spawner')!.params.frequency).toBe(1);
  });

  it('does nothing when config is null', () => {
    useGameStore.setState({ config: null, configVersion: 0 });

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 5 } },
    ]);

    expect(useGameStore.getState().config).toBeNull();
    expect(useGameStore.getState().configVersion).toBe(0);
  });

  it('does not increment version for empty updates array', () => {
    const vBefore = useGameStore.getState().configVersion;

    useGameStore.getState().batchUpdateParams([]);

    expect(useGameStore.getState().configVersion).toBe(vBefore);
  });

  it('matches suffixed module ids via baseId fallback', () => {
    // Use suffixed ids like real presets / conversation-agent
    const config: GameConfig = {
      ...makeConfig(),
      modules: [
        { id: 'spawner_1', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
    };
    useGameStore.setState({ config, configVersion: 0 });

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'spawner', changes: { frequency: 3 } },
      { moduleId: 'scorer', changes: { perHit: 30 } },
    ]);

    const next = useGameStore.getState().config!;
    expect(next.modules.find((m) => m.id === 'spawner_1')!.params.frequency).toBe(3);
    expect(next.modules.find((m) => m.id === 'scorer_1')!.params.perHit).toBe(30);
  });

  it('matches hyphenated ids to CamelCase types (e.g., beat-map → BeatMap)', () => {
    const config: GameConfig = {
      ...makeConfig(),
      modules: [
        { id: 'beatmap_1', type: 'BeatMap', enabled: true, params: { bpm: 120 } },
        { id: 'particlevfx_1', type: 'ParticleVFX', enabled: true, params: { burstScale: 1.0 } },
      ],
    };
    useGameStore.setState({ config, configVersion: 0 });

    useGameStore.getState().batchUpdateParams([
      { moduleId: 'beat-map', changes: { bpm: 150 } },
      { moduleId: 'particle-vfx', changes: { burstScale: 1.5 } },
    ]);

    const next = useGameStore.getState().config!;
    expect(next.modules.find((m) => m.type === 'BeatMap')!.params.bpm).toBe(150);
    expect(next.modules.find((m) => m.type === 'ParticleVFX')!.params.burstScale).toBe(1.5);
  });
});
