import { describe, it, expect } from 'vitest';
import type { GameConfig } from '@/engine/core/index.ts';
import { applyConfigChanges } from '../conversation-agent';

function makeTestConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: 'Test Game',
      description: 'test',
      thumbnail: null,
      createdAt: '2026-01-01',
      theme: 'fruit',
      artStyle: 'cartoon',
    },
    canvas: { width: 1080, height: 1920 },
    modules: [
      { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
      { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      { id: 'spawner_1', type: 'Spawner', enabled: true, params: { frequency: 1.5 } },
    ],
    assets: {},
  };
}

describe('applyConfigChanges', () => {
  it('should not mutate the original config', () => {
    const original = makeTestConfig();
    const originalJson = JSON.stringify(original);

    applyConfigChanges(original, [
      { action: 'set_duration', duration: 60 },
    ]);

    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it('should not mutate module params objects (set_duration)', () => {
    const config = makeTestConfig();
    const originalTimerParams = config.modules[0].params;

    const result = applyConfigChanges(config, [
      { action: 'set_duration', duration: 60 },
    ]);

    // Original params should be untouched
    expect(originalTimerParams.duration).toBe(30);
    // Result should have updated duration
    const timerMod = result.modules.find(m => m.type === 'Timer')!;
    expect(timerMod.params.duration).toBe(60);
  });

  it('should not mutate module params objects (set_param)', () => {
    const config = makeTestConfig();
    const originalScorerParams = config.modules[1].params;

    const result = applyConfigChanges(config, [
      { action: 'set_param', module_type: 'Scorer', param_key: 'perHit', param_value: 20 },
    ]);

    // Original params untouched
    expect(originalScorerParams.perHit).toBe(10);
    // Result updated
    const scorer = result.modules.find(m => m.type === 'Scorer')!;
    expect(scorer.params.perHit).toBe(20);
  });

  it('should produce a new params object reference (set_duration)', () => {
    const config = makeTestConfig();

    const result = applyConfigChanges(config, [
      { action: 'set_duration', duration: 45 },
    ]);

    const originalTimer = config.modules.find(m => m.type === 'Timer')!;
    const resultTimer = result.modules.find(m => m.type === 'Timer')!;
    expect(resultTimer.params).not.toBe(originalTimer.params);
  });

  it('should produce a new params object reference (set_param)', () => {
    const config = makeTestConfig();

    const result = applyConfigChanges(config, [
      { action: 'set_param', module_type: 'Scorer', param_key: 'perHit', param_value: 50 },
    ]);

    const originalScorer = config.modules.find(m => m.type === 'Scorer')!;
    const resultScorer = result.modules.find(m => m.type === 'Scorer')!;
    expect(resultScorer.params).not.toBe(originalScorer.params);
  });

  it('should add a module', () => {
    const config = makeTestConfig();

    const result = applyConfigChanges(config, [
      { action: 'add_module', module_type: 'ComboSystem' },
    ]);

    expect(result.modules.some(m => m.type === 'ComboSystem')).toBe(true);
    expect(config.modules.some(m => m.type === 'ComboSystem')).toBe(false);
  });

  it('should remove a module', () => {
    const config = makeTestConfig();

    const result = applyConfigChanges(config, [
      { action: 'remove_module', module_type: 'Spawner' },
    ]);

    expect(result.modules.some(m => m.type === 'Spawner')).toBe(false);
    expect(config.modules.some(m => m.type === 'Spawner')).toBe(true);
  });

  it('should change theme and clear asset src', () => {
    const config: GameConfig = {
      ...makeTestConfig(),
      assets: {
        bg: { type: 'background', src: 'old.png' },
      },
    };

    const result = applyConfigChanges(config, [
      { action: 'set_theme', theme: 'space' },
    ]);

    expect(result.meta.theme).toBe('space');
    expect(result.assets['bg'].src).toBe('');
    // Original untouched
    expect(config.meta.theme).toBe('fruit');
    expect(config.assets['bg'].src).toBe('old.png');
  });
});
