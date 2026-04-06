import { describe, it, expect } from 'vitest';
import { TOOLS, HERO_PRESET_IDS } from '../conversation-defs.ts';
import { runPresetToConfig, _resetRegistry } from '@/engine/systems/recipe-runner/facade.ts';
import type { GameConfig } from '@/engine/core/types.ts';

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

describe('use_preset tool schema', () => {
  it('use_preset tool is present in TOOLS array', () => {
    const tool = TOOLS.find((t) => t.name === 'use_preset');
    expect(tool).toBeDefined();
  });

  it('has preset_id as required property', () => {
    const tool = TOOLS.find((t) => t.name === 'use_preset');
    const schema = tool!.input_schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    expect(props.preset_id).toBeDefined();
    expect(schema.required).toContain('preset_id');
  });

  it('has params as optional property', () => {
    const tool = TOOLS.find((t) => t.name === 'use_preset');
    const schema = tool!.input_schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    expect(props.params).toBeDefined();
    // params should NOT be required
    const required = schema.required as string[];
    expect(required).not.toContain('params');
  });

  it('preset_id enum contains all hero presets from HERO_PRESET_IDS', () => {
    const tool = TOOLS.find((t) => t.name === 'use_preset');
    const schema = tool!.input_schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    const presetIdSchema = props.preset_id as Record<string, unknown>;
    const enumValues = presetIdSchema.enum as string[];

    expect(enumValues).toHaveLength(HERO_PRESET_IDS.length);
    for (const id of HERO_PRESET_IDS) {
      expect(enumValues).toContain(id);
    }
  });
});

describe('use_preset handler integration', () => {
  it('runPresetToConfig produces valid config for hero-catch-fruit', () => {
    _resetRegistry();
    const base = makeEmptyConfig();
    const result = runPresetToConfig({ presetId: 'hero-catch-fruit' }, base);

    expect(result.config.modules.length).toBeGreaterThan(0);
    expect(result.presetId).toBe('hero-catch-fruit');
  });

  it('runPresetToConfig preserves baseConfig immutability', () => {
    _resetRegistry();
    const base = makeEmptyConfig();
    const originalAssets = { ...base.assets };
    runPresetToConfig({ presetId: 'hero-shooter-wave' }, base);

    expect(base.modules).toEqual([]);
    expect(base.assets).toEqual(originalAssets);
  });

  it('backward compat: create_game tool still present', () => {
    const createGame = TOOLS.find((t) => t.name === 'create_game');
    expect(createGame).toBeDefined();
  });

  it('backward compat: modify_game tool still present', () => {
    const modifyGame = TOOLS.find((t) => t.name === 'modify_game');
    expect(modifyGame).toBeDefined();
  });
});
