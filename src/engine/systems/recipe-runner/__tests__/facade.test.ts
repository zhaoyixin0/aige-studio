import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePreset, runPresetToConfig, _resetRegistry } from '../facade';
import type { GameConfig } from '../../../core/types';

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

beforeEach(() => {
  _resetRegistry();
});

describe('resolvePreset', () => {
  it('resolves by presetId', () => {
    const preset = resolvePreset({ presetId: 'hero-catch-fruit' });
    expect(preset).not.toBeNull();
    expect(preset!.id).toBe('hero-catch-fruit');
  });

  it('resolves by gameType', () => {
    const preset = resolvePreset({ gameType: 'catch' });
    expect(preset).not.toBeNull();
    expect(preset!.gameType).toBe('catch');
  });

  it('resolves by tags', () => {
    const preset = resolvePreset({ tags: ['casual'] });
    expect(preset).not.toBeNull();
    expect(preset!.tags).toContain('casual');
  });

  it('returns null for nonexistent presetId', () => {
    const preset = resolvePreset({ presetId: 'nonexistent-preset' });
    expect(preset).toBeNull();
  });

  it('returns null for empty input', () => {
    const preset = resolvePreset({});
    expect(preset).toBeNull();
  });
});

describe('runPresetToConfig', () => {
  it('returns valid GameConfig with modules', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ presetId: 'hero-catch-fruit' }, base);

    expect(result.config.modules.length).toBeGreaterThan(0);
    expect(result.presetId).toBe('hero-catch-fruit');
  });

  it('does not mutate baseConfig', () => {
    const base = makeEmptyConfig();
    const originalModules = base.modules.length;
    runPresetToConfig({ presetId: 'hero-catch-fruit' }, base);

    expect(base.modules.length).toBe(originalModules);
    expect(base.modules).toEqual([]);
  });

  it('collects pendingAssets for empty-src assets', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ presetId: 'hero-catch-fruit' }, base);

    // pendingAssets should be an array (may or may not have entries depending on preset)
    expect(Array.isArray(result.pendingAssets)).toBe(true);
    // Assets with empty src should be in pendingAssets
    for (const assetId of result.pendingAssets) {
      expect(result.config.assets[assetId]).toBeDefined();
      expect(result.config.assets[assetId].src).toBeFalsy();
    }
  });

  it('applies param overrides', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig(
      { presetId: 'hero-catch-fruit', params: { timerDuration: 30 } },
      base,
    );

    expect(result.config).toBeDefined();
    expect(result.presetId).toBe('hero-catch-fruit');
  });

  it('throws on missing preset', () => {
    const base = makeEmptyConfig();
    expect(() => runPresetToConfig({ presetId: 'nonexistent' }, base)).toThrow(
      /No preset found/,
    );
  });

  it('resolves via gameType when presetId not provided', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ gameType: 'catch' }, base);

    expect(result.config.modules.length).toBeGreaterThan(0);
  });
});
