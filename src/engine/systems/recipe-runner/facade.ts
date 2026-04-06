// src/engine/systems/recipe-runner/facade.ts
// Single entry point: PresetRegistry → RecipeExecutor → GameConfig output.

import { createHeroRegistry } from './index';
import { RecipeExecutor } from './recipe-executor';
import type { PresetRegistry } from './preset-registry';
import type { PresetTemplate } from './types';
import type { GameConfig } from '../../core/types';

// ── Lazy singleton (safe for HMR — initialized once, reset only in tests) ──

let _registry: PresetRegistry = createHeroRegistry();

function getHeroRegistry(): PresetRegistry {
  return _registry;
}

// ── Types ──

export interface PresetInput {
  readonly presetId?: string;
  readonly gameType?: string;
  readonly tags?: readonly string[];
  readonly params?: Record<string, unknown>;
}

export interface PresetResult {
  readonly config: GameConfig;
  readonly presetId: string;
  readonly pendingAssets: readonly string[];
}

// ── Public API ──

export function resolvePreset(input: PresetInput): PresetTemplate | null {
  const registry = getHeroRegistry();

  if (input.presetId) {
    return registry.get(input.presetId) ?? null;
  }
  if (input.gameType) {
    const matches = registry.findByGameType(input.gameType);
    if (matches.length > 0) return matches[0];
  }
  if (input.tags?.length) {
    const matches = registry.findByTags([...input.tags]);
    if (matches.length > 0) return matches[0];
  }
  return null;
}

export function runPresetToConfig(
  input: PresetInput,
  baseConfig: GameConfig,
): PresetResult {
  const preset = resolvePreset(input);
  if (!preset) {
    const id = input.presetId ?? input.gameType ?? 'unknown';
    throw new Error(`No preset found for: ${id}`);
  }

  // Build variables from preset defaults, then merge only declared param overrides
  const allowedKeys = new Set(preset.params.map((p) => p.name));
  const defaults = Object.fromEntries(preset.params.map((p) => [p.name, p.default]));
  const overrides = input.params
    ? Object.fromEntries(
        Object.entries(input.params).filter(([k]) => allowedKeys.has(k)),
      )
    : {};
  const variables: Record<string, unknown> = { ...defaults, ...overrides };

  const result = RecipeExecutor.execute(preset.sequence, baseConfig, variables);
  if (!result.success) {
    throw new Error(`Preset execution failed: ${result.error}`);
  }

  // Extract assets with empty src
  const pendingAssets = Object.entries(result.config.assets)
    .filter(([, entry]) => !entry.src)
    .map(([id]) => id);

  return {
    config: result.config,
    presetId: preset.id,
    pendingAssets,
  };
}

/** Reset registry — test-only. No-op in production. */
export function _resetRegistry(): void {
  if (import.meta.env.MODE === 'test') {
    _registry = createHeroRegistry();
  }
}
