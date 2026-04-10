// src/engine/systems/recipe-runner/facade.ts
// Single entry point: PresetRegistry → RecipeExecutor → GameConfig output.
//
// Routing:
//   - hero-skeleton presets (kind:'hero-skeleton')  → buildGameConfigPure
//   - legacy hero / expert templates (sequence)     → RecipeExecutor

import { createHeroRegistry, createExpertRegistry, HERO_SKELETON_PRESETS } from './index';
import { RecipeExecutor } from './recipe-executor';
import type { PresetRegistry } from './preset-registry';
import type { PresetTemplate } from './types';
import type { GameConfig } from '../../core/types';
import { buildHeroSkeletonConfig } from './hero-skeleton-builder';

// ── Lazy singletons (safe for HMR — initialized once, reset only in tests) ──

let _registry: PresetRegistry = createHeroRegistry();
let _expertRegistry: PresetRegistry = createExpertRegistry();

function getHeroRegistry(): PresetRegistry {
  return _registry;
}

function getExpertRegistry(): PresetRegistry {
  return _expertRegistry;
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

/**
 * Resolve a hero-skeleton preset JSON by id. Returns null if the id is
 * unknown or not a hero-skeleton. Does NOT fall back to legacy templates.
 */
export function resolveHeroSkeleton(presetId: string): unknown | null {
  const skeleton = HERO_SKELETON_PRESETS[presetId];
  return skeleton ?? null;
}

/**
 * Find the first hero-skeleton preset whose gameType matches the given type.
 * Returns null if none match. Used as a fallback when runPresetToConfig is
 * called without an explicit presetId.
 */
function findHeroSkeletonByGameType(gameType?: string): string | null {
  if (!gameType) return null;
  for (const [id, preset] of Object.entries(HERO_SKELETON_PRESETS)) {
    if (
      typeof preset === 'object' &&
      preset !== null &&
      (preset as Record<string, unknown>).gameType === gameType
    ) {
      return id;
    }
  }
  return null;
}

export function resolvePreset(input: PresetInput): PresetTemplate | null {
  const registry = getHeroRegistry();
  const expert = getExpertRegistry();

  // Hero registry first (curated, higher quality)
  if (input.presetId) {
    const hero = registry.get(input.presetId);
    if (hero) return hero;
    // Fallback to expert registry
    const exp = expert.get(input.presetId);
    if (exp) return exp;
    return null;
  }
  if (input.gameType) {
    const heroMatches = registry.findByGameType(input.gameType);
    if (heroMatches.length > 0) return heroMatches[0];
    // Fallback to expert registry
    const expMatches = expert.findByGameType(input.gameType);
    if (expMatches.length > 0) return expMatches[0];
  }
  if (input.tags?.length) {
    const heroMatches = registry.findByTags([...input.tags]);
    if (heroMatches.length > 0) return heroMatches[0];
    // Fallback to expert registry
    const expMatches = expert.findByTags([...input.tags]);
    if (expMatches.length > 0) return expMatches[0];
  }
  return null;
}

export function runPresetToConfig(
  input: PresetInput,
  baseConfig: GameConfig,
): PresetResult {
  // Hero-skeleton path: new declarative format routed through buildGameConfigPure
  const skeletonId = input.presetId && resolveHeroSkeleton(input.presetId) !== null
    ? input.presetId
    : findHeroSkeletonByGameType(input.gameType);
  if (skeletonId) {
    const skeleton = resolveHeroSkeleton(skeletonId)!;
    const built = buildHeroSkeletonConfig(skeleton);
    // Preserve baseConfig canvas dimensions if caller specified custom values
    const merged: GameConfig = {
      ...built.config,
      canvas: baseConfig.canvas?.width ? baseConfig.canvas : built.config.canvas,
    };
    const pendingAssets = Object.entries(merged.assets)
      .filter(([, entry]) => !entry.src)
      .map(([id]) => id);
    return {
      config: merged,
      presetId: built.presetId,
      pendingAssets,
    };
  }

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

  // Inject the preset's declared gameType into config.meta so downstream
  // consumers (notably ConversationAgent.inferGameType) can recover niche
  // expert types that do not map onto native engine modules.
  const configWithGameType: GameConfig = preset.gameType
    ? {
        ...result.config,
        meta: { ...result.config.meta, gameType: preset.gameType },
      }
    : result.config;

  // Extract assets with empty src
  const pendingAssets = Object.entries(configWithGameType.assets)
    .filter(([, entry]) => !entry.src)
    .map(([id]) => id);

  return {
    config: configWithGameType,
    presetId: preset.id,
    pendingAssets,
  };
}

/** Reset registries — test-only. No-op in production. */
export function _resetRegistry(): void {
  if (import.meta.env.MODE === 'test') {
    _registry = createHeroRegistry();
    _expertRegistry = createExpertRegistry();
  }
}
