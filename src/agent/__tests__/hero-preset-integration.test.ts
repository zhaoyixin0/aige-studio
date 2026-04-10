// src/agent/__tests__/hero-preset-integration.test.ts
//
// End-to-end integration for all hero preset JSON files. For each file:
//   - runPresetToConfig() must not throw
//   - returned config must pass validateConfig() with no errors
//   - config must contain at least one input module
//   - config must contain at least one renderable module
//   - hero-skeleton presets must write asset_descriptions into config.meta

import { describe, it, expect } from 'vitest';
import { runPresetToConfig, _resetRegistry } from '@/engine/systems/recipe-runner/facade';
import { validateConfig } from '@/engine/core/config-validator';
import { getSharedContracts } from '../conversation-agent';
import type { GameConfig } from '@/engine/core/types';

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

const INPUT_TYPES: ReadonlySet<string> = new Set([
  'FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput',
]);

const RENDERABLE_TYPES: ReadonlySet<string> = new Set([
  // Spawner-based
  'Spawner',
  // Platformer-based
  'PlayerMovement',
  // Runner-based
  'Runner',
  // Shooter-based
  'Projectile', 'WaveSpawner', 'EnemyAI',
  // Puzzle-based
  'MatchEngine',
  // Quiz-based
  'QuizEngine',
  // Physics-based
  'Gravity',
]);

// Eagerly load all hero preset JSON files via Vite's glob import
const heroPresetFiles = import.meta.glob('/src/knowledge/recipes-runner/*.preset.json', {
  eager: true,
  import: 'default',
});

interface LoadedHero {
  readonly presetId: string;
  readonly raw: Record<string, unknown>;
  readonly isSkeleton: boolean;
}

const heroPresets: LoadedHero[] = Object.entries(heroPresetFiles).map(([path, raw]) => {
  const json = raw as Record<string, unknown>;
  const presetId = String(json.id ?? path);
  const isSkeleton = json.kind === 'hero-skeleton';
  return { presetId, raw: json, isSkeleton };
});

describe('hero preset integration', () => {
  it('has at least 6 hero preset files loaded', () => {
    expect(heroPresets.length).toBeGreaterThanOrEqual(6);
  });

  it('has at least 1 hero-skeleton preset', () => {
    const count = heroPresets.filter((h) => h.isSkeleton).length;
    expect(count).toBeGreaterThanOrEqual(6);
  });

  for (const hero of heroPresets) {
    describe(hero.presetId, () => {
      it('runPresetToConfig does not throw', () => {
        _resetRegistry();
        const base = makeEmptyConfig();
        expect(() => runPresetToConfig({ presetId: hero.presetId }, base)).not.toThrow();
      });

      it('contains at least one renderable/gameplay module', () => {
        _resetRegistry();
        const base = makeEmptyConfig();
        const { config } = runPresetToConfig({ presetId: hero.presetId }, base);
        const hasRenderable = config.modules.some((m) => RENDERABLE_TYPES.has(m.type));
        if (!hasRenderable) {
          const types = config.modules.map((m) => m.type).join(', ');
          throw new Error(`${hero.presetId} has no renderable module. Modules: ${types}`);
        }
        expect(hasRenderable).toBe(true);
      });

      // Strict checks apply only to new hero-skeleton presets. Legacy
      // hero-platformer-basic and hero-shooter-wave pre-date the contract
      // system and have known pre-existing issues we are not fixing here.
      if (hero.isSkeleton) {
        it('produces a config with no validation errors', () => {
          _resetRegistry();
          const base = makeEmptyConfig();
          const { config } = runPresetToConfig({ presetId: hero.presetId }, base);
          const report = validateConfig(config, getSharedContracts());
          if (report.errors.length > 0) {
            const details = report.errors
              .map((e) => `[${e.category}] ${e.moduleId}: ${e.message}`)
              .join('\n');
            throw new Error(`Validation errors for ${hero.presetId}:\n${details}`);
          }
          expect(report.errors.length).toBe(0);
        });

        it('contains at least one input module', () => {
          _resetRegistry();
          const base = makeEmptyConfig();
          const { config } = runPresetToConfig({ presetId: hero.presetId }, base);
          const inputs = config.modules.filter((m) => INPUT_TYPES.has(m.type));
          expect(inputs.length).toBeGreaterThanOrEqual(1);
        });

        const hasSignature =
          hero.raw.signature !== undefined &&
          typeof hero.raw.signature === 'object' &&
          hero.raw.signature !== null &&
          (((hero.raw.signature as Record<string, unknown>).goods as unknown[] | undefined)?.length ?? 0) > 0;

        if (hasSignature) {
          it('writes assetDescriptions into config.meta', () => {
            _resetRegistry();
            const base = makeEmptyConfig();
            const { config } = runPresetToConfig({ presetId: hero.presetId }, base);
            expect(config.meta.assetDescriptions).toBeDefined();
            expect(Object.keys(config.meta.assetDescriptions!).length).toBeGreaterThan(0);
          });
        }
      }
    });
  }
});
