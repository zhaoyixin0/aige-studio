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

  it('should apply multiple changes in sequence correctly', () => {
    const config: GameConfig = {
      ...makeTestConfig(),
      assets: { bg: { type: 'background', src: 'old.png' } },
    };

    const result = applyConfigChanges(config, [
      { action: 'set_theme', theme: 'space' },
      { action: 'set_duration', duration: 60 },
      { action: 'add_module', module_type: 'ComboSystem' },
      { action: 'remove_module', module_type: 'Spawner' },
    ]);

    // All four changes applied
    expect(result.meta.theme).toBe('space');
    expect(result.modules.find((m) => m.type === 'Timer')!.params.duration).toBe(60);
    expect(result.modules.some((m) => m.type === 'ComboSystem')).toBe(true);
    expect(result.modules.some((m) => m.type === 'Spawner')).toBe(false);
    // Asset src cleared by theme change
    expect(result.assets['bg'].src).toBe('');
    // Original untouched
    expect(config.meta.theme).toBe('fruit');
    expect(config.modules.some((m) => m.type === 'Spawner')).toBe(true);
    expect(config.modules.some((m) => m.type === 'ComboSystem')).toBe(false);
  });

  it('should produce independent module objects (no shared refs with input)', () => {
    const config = makeTestConfig();
    const result = applyConfigChanges(config, [
      { action: 'set_duration', duration: 99 },
    ]);
    // Mutating the result's module should not affect the original
    const resultTimer = result.modules.find((m) => m.type === 'Timer')!;
    resultTimer.params.duration = 999;
    expect(config.modules[0].params.duration).toBe(30);
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

  describe('set_asset_description action (P4)', () => {
    it('should set a new asset description into meta.assetDescriptions', () => {
      const config = makeTestConfig();
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: 'A shiny golden star',
        },
      ]);

      expect(result.meta.assetDescriptions).toBeDefined();
      expect(result.meta.assetDescriptions!['good_1']).toBe('A shiny golden star');
      // Original untouched (no mutation)
      expect(config.meta.assetDescriptions).toBeUndefined();
    });

    it('should merge with existing assetDescriptions without clobbering others', () => {
      const config: GameConfig = {
        ...makeTestConfig(),
        meta: {
          ...makeTestConfig().meta,
          assetDescriptions: { player: 'A cute bunny', background: 'Forest' },
        },
      };

      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: 'A shiny golden star',
        },
      ]);

      expect(result.meta.assetDescriptions!['player']).toBe('A cute bunny');
      expect(result.meta.assetDescriptions!['background']).toBe('Forest');
      expect(result.meta.assetDescriptions!['good_1']).toBe('A shiny golden star');
      // Original dictionary reference not mutated
      expect(Object.keys(config.meta.assetDescriptions!)).toEqual(['player', 'background']);
    });

    it('should overwrite existing description for the same asset_id', () => {
      const config: GameConfig = {
        ...makeTestConfig(),
        meta: {
          ...makeTestConfig().meta,
          assetDescriptions: { player: 'Old description' },
        },
      };

      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'player',
          description: 'New description',
        },
      ]);

      expect(result.meta.assetDescriptions!['player']).toBe('New description');
      // Original untouched
      expect(config.meta.assetDescriptions!['player']).toBe('Old description');
    });

    it('should ignore set_asset_description when asset_id is missing', () => {
      const config = makeTestConfig();
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          description: 'Orphan description',
        },
      ]);

      expect(result.meta.assetDescriptions).toBeUndefined();
    });

    it('should ignore set_asset_description when description is missing', () => {
      const config = makeTestConfig();
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
        },
      ]);

      expect(result.meta.assetDescriptions).toBeUndefined();
    });

    it('should not affect modules or assets when only setting descriptions', () => {
      const config: GameConfig = {
        ...makeTestConfig(),
        assets: { bg: { type: 'background', src: 'existing.png' } },
      };
      const originalModules = config.modules;

      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'bg',
          description: 'A dark forest',
        },
      ]);

      // Modules untouched
      expect(result.modules).toEqual(originalModules);
      // Asset src preserved (no clearing)
      expect(result.assets['bg'].src).toBe('existing.png');
    });

    it('should produce a new meta object reference (immutability)', () => {
      const config = makeTestConfig();
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: 'A sparkly gem',
        },
      ]);

      expect(result.meta).not.toBe(config.meta);
    });

    it('should truncate description to 300 characters', () => {
      const config = makeTestConfig();
      const longDesc = 'A'.repeat(500);
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: longDesc,
        },
      ]);

      expect(result.meta.assetDescriptions).toBeDefined();
      expect(result.meta.assetDescriptions!['good_1'].length).toBeLessThanOrEqual(300);
      expect(result.meta.assetDescriptions!['good_1']).toBe('A'.repeat(300));
    });

    it('should not truncate description under 300 characters', () => {
      const config = makeTestConfig();
      const shortDesc = 'A short description';
      const result = applyConfigChanges(config, [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: shortDesc,
        },
      ]);

      expect(result.meta.assetDescriptions!['good_1']).toBe(shortDesc);
    });
  });
});
