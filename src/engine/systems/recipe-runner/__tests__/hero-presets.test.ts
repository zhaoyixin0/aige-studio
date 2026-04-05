import { describe, it, expect, beforeAll } from 'vitest';
import { PresetRegistry } from '../preset-registry';
import { RecipeExecutor } from '../recipe-executor';
import type { PresetTemplate } from '../types';
import type { GameConfig } from '@/engine/core/types';

// Load hero presets via import.meta.glob
const presetFiles = import.meta.glob('/src/knowledge/recipes-runner/*.preset.json', {
  eager: true,
  import: 'default',
});

const heroPresets: PresetTemplate[] = Object.values(presetFiles) as PresetTemplate[];

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

describe('Hero Recipe Presets', () => {
  let registry: PresetRegistry;

  beforeAll(() => {
    registry = new PresetRegistry();
    registry.registerAll(heroPresets);
  });

  it('loads 8 hero presets', () => {
    expect(heroPresets.length).toBe(8);
    expect(registry.size()).toBe(8);
  });

  it('each preset passes registry validation', () => {
    for (const preset of heroPresets) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.tags.length).toBeGreaterThan(0);
      expect(preset.sequence.commands.length).toBeGreaterThan(0);
    }
  });

  it('each preset has unique id', () => {
    const ids = heroPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each preset has gameType', () => {
    for (const preset of heroPresets) {
      expect(preset.gameType).toBeTruthy();
    }
  });

  it('each preset has requiredModules', () => {
    for (const preset of heroPresets) {
      expect(preset.requiredModules).toBeDefined();
      expect(preset.requiredModules!.length).toBeGreaterThan(0);
    }
  });

  it('executor produces valid GameConfig from each preset', () => {
    for (const preset of heroPresets) {
      // Build variables from param defaults
      const vars: Record<string, unknown> = {};
      for (const p of preset.params) {
        if (p.default !== undefined) vars[p.name] = p.default;
      }

      const result = RecipeExecutor.execute(preset.sequence, makeEmptyConfig(), vars);
      expect(result.success, `Preset ${preset.id} failed: ${result.error}`).toBe(true);
      expect(result.config.modules.length).toBeGreaterThan(0);
    }
  });

  it('all requiredModules present after execution', () => {
    for (const preset of heroPresets) {
      const vars: Record<string, unknown> = {};
      for (const p of preset.params) {
        if (p.default !== undefined) vars[p.name] = p.default;
      }

      const result = RecipeExecutor.execute(preset.sequence, makeEmptyConfig(), vars);
      if (!result.success) continue;
      const moduleTypes = new Set(result.config.modules.map((m) => m.type));
      for (const req of preset.requiredModules ?? []) {
        expect(moduleTypes.has(req), `${preset.id} missing ${req}`).toBe(true);
      }
    }
  });

  it('determinism: same inputs produce same config', () => {
    for (const preset of heroPresets) {
      const vars: Record<string, unknown> = {};
      for (const p of preset.params) {
        if (p.default !== undefined) vars[p.name] = p.default;
      }

      const a = RecipeExecutor.execute(preset.sequence, makeEmptyConfig(), vars);
      const b = RecipeExecutor.execute(preset.sequence, makeEmptyConfig(), vars);
      expect(JSON.stringify(a.config)).toBe(JSON.stringify(b.config));
    }
  });

  it('findByGameType returns matching presets', () => {
    const catchPresets = registry.findByGameType('catch');
    expect(catchPresets.length).toBeGreaterThanOrEqual(1);
  });

  it('search returns matching presets', () => {
    const results = registry.search('shooter');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
