/**
 * Registry↔Config Binding Layer
 *
 * Maps Parameter Registry IDs to GameConfig module params / meta fields.
 * Provides read (getLiveValuesForParams) and write (planUpdatesForParamChange) helpers.
 */

import type { GameConfig, GameMeta } from '@/engine/core/types';
// getParamById available for future per-param lookups

// --- Mapping types ---

interface ModuleMapping {
  kind: 'module';
  moduleType: string;
  paramKey: string; // '_enabled' for L2 toggles, actual param name for L3
}

interface MetaMapping {
  kind: 'meta';
  metaKey: keyof GameMeta;
}

type ParamMapping = ModuleMapping | MetaMapping;

// --- Static mapping table ---
// L2 system names → module types (toggle enabled/disabled)
// L3 params → module type + specific param key

export const PARAM_TO_MODULE_MAP: Record<string, ParamMapping> = {
  // L1 abstract (handled by CompositeMapper, not direct mapping)
  // l1_001 游戏难度, l1_002 游戏节奏, l1_003 游戏情绪 → use applyL1Preset instead

  // L2 system toggles → module enabled state
  game_mechanics_001: { kind: 'module', moduleType: 'Scorer', paramKey: '_enabled' },
  game_mechanics_002: { kind: 'module', moduleType: 'Collision', paramKey: '_enabled' },
  game_mechanics_003: { kind: 'module', moduleType: 'TouchInput', paramKey: '_enabled' },
  game_mechanics_005: { kind: 'module', moduleType: 'DifficultyRamp', paramKey: '_enabled' },
  game_mechanics_006: { kind: 'module', moduleType: 'Lives', paramKey: '_enabled' },
  game_mechanics_007: { kind: 'module', moduleType: 'Spawner', paramKey: '_enabled' },
  game_mechanics_008: { kind: 'module', moduleType: 'Jump', paramKey: '_enabled' },
  game_mechanics_017: { kind: 'module', moduleType: 'PowerUp', paramKey: '_enabled' },

  // Visual/audio toggles
  visual_audio_001: { kind: 'module', moduleType: 'UIOverlay', paramKey: '_enabled' },
  visual_audio_002: { kind: 'module', moduleType: 'ResultScreen', paramKey: '_enabled' },
  visual_audio_007: { kind: 'module', moduleType: 'SoundFX', paramKey: '_enabled' },
  visual_audio_015: { kind: 'module', moduleType: 'ParticleVFX', paramKey: '_enabled' },

  // Meta mappings
  visual_audio_003: { kind: 'meta', metaKey: 'artStyle' },

  // L3 direct param mappings (selected high-priority ones)
  // Scorer params
  game_mechanics_009: { kind: 'module', moduleType: 'Scorer', paramKey: 'perHit' },
  game_mechanics_010: { kind: 'module', moduleType: 'Scorer', paramKey: 'comboWindow' },
  game_mechanics_011: { kind: 'module', moduleType: 'Scorer', paramKey: 'comboMultiplierStep' },

  // Spawner params
  game_mechanics_013: { kind: 'module', moduleType: 'Spawner', paramKey: 'frequency' },
  game_mechanics_014: { kind: 'module', moduleType: 'Spawner', paramKey: 'speed' },
  game_mechanics_015: { kind: 'module', moduleType: 'Spawner', paramKey: 'maxCount' },

  // Lives params
  game_mechanics_022: { kind: 'module', moduleType: 'Lives', paramKey: 'count' },

  // Timer params
  visual_audio_005: { kind: 'module', moduleType: 'Timer', paramKey: 'duration' },

  // Collision params
  game_mechanics_016: { kind: 'module', moduleType: 'Collision', paramKey: 'hitboxScale' },

  // Jump params
  game_mechanics_025: { kind: 'module', moduleType: 'Jump', paramKey: 'jumpForce' },
  game_mechanics_026: { kind: 'module', moduleType: 'Jump', paramKey: 'doubleJump' },

  // Runner params
  game_mechanics_033: { kind: 'module', moduleType: 'Runner', paramKey: 'laneCount' },
  game_mechanics_034: { kind: 'module', moduleType: 'Runner', paramKey: 'speed' },
};

// --- Read: get live values from config for given paramIds ---

export function getLiveValuesForParams(
  config: GameConfig | null,
  paramIds: readonly string[],
): Record<string, unknown> {
  if (!config) return {};

  const result: Record<string, unknown> = {};

  for (const paramId of paramIds) {
    const mapping = PARAM_TO_MODULE_MAP[paramId];
    if (!mapping) continue;

    if (mapping.kind === 'meta') {
      result[paramId] = config.meta[mapping.metaKey];
    } else if (mapping.paramKey === '_enabled') {
      const mod = config.modules.find((m) => m.type === mapping.moduleType);
      result[paramId] = mod?.enabled ?? false;
    } else {
      const mod = config.modules.find((m) => m.type === mapping.moduleType);
      if (mod) {
        result[paramId] = mod.params[mapping.paramKey];
      }
    }
  }

  return result;
}

// --- Write: plan updates for a param change ---

export interface UpdatePlan {
  meta?: Partial<GameMeta>;
  params: Array<{ moduleId: string; changes: Record<string, unknown> }>;
}

export function planUpdatesForParamChange(
  paramId: string,
  value: unknown,
  config: GameConfig,
): UpdatePlan {
  const mapping = PARAM_TO_MODULE_MAP[paramId];
  if (!mapping) return { params: [] };

  if (mapping.kind === 'meta') {
    return {
      meta: { [mapping.metaKey]: value } as Partial<GameMeta>,
      params: [],
    };
  }

  if (mapping.paramKey === '_enabled') {
    // Toggle module enabled state — find by type
    const mod = config.modules.find((m) => m.type === mapping.moduleType);
    if (!mod) return { params: [] };
    // Return as a special enabled toggle — caller should handle via toggleModule or setConfig
    return {
      params: [{ moduleId: mod.id, changes: { _enabled: value } }],
    };
  }

  // Regular param update
  const mod = config.modules.find((m) => m.type === mapping.moduleType);
  if (!mod) return { params: [] };

  return {
    params: [{ moduleId: mod.id, changes: { [mapping.paramKey]: value } }],
  };
}

// --- Bulk: extract all mapped values from config ---

export function extractRegistryValueMap(
  config: GameConfig | null,
): Map<string, unknown> {
  if (!config) return new Map();

  const result = new Map<string, unknown>();

  for (const [paramId, mapping] of Object.entries(PARAM_TO_MODULE_MAP)) {
    if (mapping.kind === 'meta') {
      result.set(paramId, config.meta[mapping.metaKey]);
    } else if (mapping.paramKey === '_enabled') {
      const mod = config.modules.find((m) => m.type === mapping.moduleType);
      result.set(paramId, mod?.enabled ?? false);
    } else {
      const mod = config.modules.find((m) => m.type === mapping.moduleType);
      if (mod) {
        result.set(paramId, mod.params[mapping.paramKey]);
      }
    }
  }

  return result;
}
