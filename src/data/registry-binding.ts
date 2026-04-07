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
  valueMap?: Record<string, unknown>; // optional UI label → engine value transform
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
  // Touch input mode selector (单击→tap, 滑动→swipe, 倾斜→tap: no tilt support yet, falls back to tap)
  game_mechanics_004: {
    kind: 'module',
    moduleType: 'TouchInput',
    paramKey: 'gesture',
    valueMap: { '单击': 'tap', '滑动': 'swipe', '倾斜': 'tap' },
  },
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
  // Spawner params
  game_mechanics_014: { kind: 'module', moduleType: 'Spawner', paramKey: 'speed' },

  // Collision params
  game_mechanics_016: { kind: 'module', moduleType: 'Collision', paramKey: 'hitboxScale' },

  // Lives params (018 = 生命值)
  game_mechanics_018: { kind: 'module', moduleType: 'Lives', paramKey: 'count' },

  // Jump params (021 = 二段跳)
  game_mechanics_021: { kind: 'module', moduleType: 'Jump', paramKey: 'doubleJump' },

  // Timer params
  visual_audio_005: { kind: 'module', moduleType: 'Timer', paramKey: 'duration' },

  // HUD visibility toggles
  visual_audio_004: { kind: 'module', moduleType: 'UIOverlay', paramKey: 'showScore' },
  visual_audio_010: { kind: 'module', moduleType: 'UIOverlay', paramKey: 'showLives' },

  // Result screen toggles
  visual_audio_011: { kind: 'module', moduleType: 'ResultScreen', paramKey: 'showAnimation' },
  visual_audio_012: { kind: 'module', moduleType: 'ResultScreen', paramKey: 'showText' },

  // Float text toggle (scoring popups only, not system announcements)
  visual_audio_028: { kind: 'module', moduleType: 'UIOverlay', paramKey: 'showFloatText' },
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
        const engineValue = mod.params[mapping.paramKey];
        if (mapping.valueMap) {
          const entry = Object.entries(mapping.valueMap).find(([, v]) => v === engineValue);
          result[paramId] = entry ? entry[0] : engineValue;
        } else {
          result[paramId] = engineValue;
        }
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

  // Apply valueMap transform if present
  const finalValue = mapping.valueMap
    ? (mapping.valueMap[String(value)] ?? value)
    : value;

  return {
    params: [{ moduleId: mod.id, changes: { [mapping.paramKey]: finalValue } }],
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
        const engineValue = mod.params[mapping.paramKey];
        if (mapping.valueMap) {
          const entry = Object.entries(mapping.valueMap).find(([, v]) => v === engineValue);
          result.set(paramId, entry ? entry[0] : engineValue);
        } else {
          result.set(paramId, engineValue);
        }
      }
    }
  }

  return result;
}
