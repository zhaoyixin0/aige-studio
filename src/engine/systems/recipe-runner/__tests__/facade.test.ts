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

// Note: all hero presets (including hero-platformer-basic and
// hero-shooter-wave) are now hero-skeleton v2 and resolve via
// HERO_SKELETON_PRESETS inside runPresetToConfig. resolvePreset() only
// returns legacy PresetTemplate entries, which means hero ids are null
// and gameType/tags fall through to the expert registry.

describe('resolvePreset', () => {
  it('returns null for a hero-skeleton presetId (not a legacy template)', () => {
    const preset = resolvePreset({ presetId: 'hero-platformer-basic' });
    expect(preset).toBeNull();
  });

  it('resolves an expert preset by gameType fallback', () => {
    const preset = resolvePreset({ gameType: 'platformer' });
    expect(preset).not.toBeNull();
    expect(preset!.gameType).toBe('platformer');
  });

  it('resolves an expert preset by tags fallback', () => {
    const preset = resolvePreset({ tags: ['expert-import'] });
    expect(preset).not.toBeNull();
    expect(preset!.tags).toContain('expert-import');
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

describe('runPresetToConfig — hero-skeleton', () => {
  it('returns valid GameConfig with modules for hero-catch-fruit', () => {
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

    expect(Array.isArray(result.pendingAssets)).toBe(true);
    for (const assetId of result.pendingAssets) {
      expect(result.config.assets[assetId]).toBeDefined();
      expect(result.config.assets[assetId].src).toBeFalsy();
    }
  });

  it('writes asset_descriptions into config.meta.assetDescriptions', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ presetId: 'hero-catch-fruit' }, base);
    expect(result.config.meta.assetDescriptions).toBeDefined();
    expect(result.config.meta.assetDescriptions!.good_1).toBe('火龙果');
  });
});

describe('runPresetToConfig — routing', () => {
  it('routes hero-platformer-basic through the skeleton builder', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig(
      { presetId: 'hero-platformer-basic' },
      base,
    );
    expect(result.config).toBeDefined();
    expect(result.presetId).toBe('hero-platformer-basic');
    expect(result.config.meta.gameType).toBe('platformer');
  });

  it('routes hero-shooter-wave through the skeleton builder', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig(
      { presetId: 'hero-shooter-wave' },
      base,
    );
    expect(result.config).toBeDefined();
    expect(result.presetId).toBe('hero-shooter-wave');
    expect(result.config.meta.gameType).toBe('shooting');
  });

  it('throws on missing preset', () => {
    const base = makeEmptyConfig();
    expect(() => runPresetToConfig({ presetId: 'nonexistent' }, base)).toThrow(
      /No preset found/,
    );
  });

  it('resolves via gameType when presetId not provided', () => {
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ gameType: 'platformer' }, base);
    expect(result.config.modules.length).toBeGreaterThan(0);
  });
});
