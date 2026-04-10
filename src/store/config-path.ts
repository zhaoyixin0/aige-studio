/**
 * Small immutable path writer for GameConfig field-level edits.
 *
 * Supported path grammar (kept intentionally narrow — callers should only
 * use the handful of shapes enumerated here):
 *   - modules[<moduleId>].params.<key>
 *   - modules[<moduleId>].params.<key>[<index>].<subkey>
 *   - meta.<key>
 *   - meta.assetDescriptions.<assetId>
 *   - assets.<assetId>.src
 *   - assets.<assetId>.type
 *
 * Any other shape returns the config unchanged. Never mutates the input.
 */
import type { GameConfig } from '@/engine/core';

const MODULES_RE = /^modules\[([^\]]+)\]\.params\.(.+)$/;
const ASSETS_RE = /^assets\.([^.]+)\.(src|type)$/;

const WRITABLE_META_KEYS: ReadonlySet<string> = new Set([
  'name', 'description', 'theme', 'artStyle', 'background',
  'playerEmoji', 'spriteSize',
]);

export function applyConfigPath(
  config: GameConfig,
  path: string,
  value: unknown,
): GameConfig {
  if (!path) return config;

  // meta.*
  if (path.startsWith('meta.')) {
    return writeMeta(config, path.slice('meta.'.length), value);
  }

  // modules[<id>].params.<...>
  const modMatch = path.match(MODULES_RE);
  if (modMatch) {
    const [, moduleId, paramsPath] = modMatch;
    return writeModuleParam(config, moduleId, paramsPath, value);
  }

  // assets.<id>.(src|type)
  const assetMatch = path.match(ASSETS_RE);
  if (assetMatch) {
    const [, assetId, field] = assetMatch;
    return writeAssetField(config, assetId, field, value);
  }

  return config;
}

function writeMeta(
  config: GameConfig,
  tail: string,
  value: unknown,
): GameConfig {
  // meta.assetDescriptions.<assetId>
  if (tail.startsWith('assetDescriptions.')) {
    const assetId = tail.slice('assetDescriptions.'.length);
    if (!assetId) return config;
    const prev = config.meta.assetDescriptions ?? {};
    return {
      ...config,
      meta: {
        ...config.meta,
        assetDescriptions: { ...prev, [assetId]: String(value ?? '') },
      },
    };
  }

  // Top-level meta.<key> — only allow known writable keys.
  // Reject unknown or sentinel keys to prevent LLM/buggy caller overwrites.
  if (!WRITABLE_META_KEYS.has(tail)) return config;

  return {
    ...config,
    meta: {
      ...config.meta,
      [tail]: value,
    } as GameConfig['meta'],
  };
}

function writeModuleParam(
  config: GameConfig,
  moduleId: string,
  paramsPath: string,
  value: unknown,
): GameConfig {
  const idx = config.modules.findIndex((m) => m.id === moduleId);
  if (idx < 0) return config;

  // Simple single-key case: params.<key>
  if (!paramsPath.includes('[') && !paramsPath.includes('.')) {
    const target = config.modules[idx];
    return {
      ...config,
      modules: config.modules.map((m, i) =>
        i === idx
          ? { ...target, params: { ...target.params, [paramsPath]: value } }
          : m,
      ),
    };
  }

  // Nested array path: <key>[<index>].<subkey> — used for e.g. spawner
  // item overrides. Supported only one-deep to keep the parser simple.
  const arrayMatch = paramsPath.match(/^([^[]+)\[(\d+)\]\.(.+)$/);
  if (arrayMatch) {
    const [, key, idxStr, subKey] = arrayMatch;
    const arrIdx = Number(idxStr);
    const target = config.modules[idx];
    const existingArr = target.params[key];
    if (!Array.isArray(existingArr)) return config;
    const nextArr = existingArr.map((entry, i) => {
      if (i !== arrIdx) return entry;
      if (typeof entry !== 'object' || entry === null) return entry;
      return { ...(entry as Record<string, unknown>), [subKey]: value };
    });
    return {
      ...config,
      modules: config.modules.map((m, i) =>
        i === idx
          ? { ...target, params: { ...target.params, [key]: nextArr } }
          : m,
      ),
    };
  }

  return config;
}

function writeAssetField(
  config: GameConfig,
  assetId: string,
  field: 'src' | 'type',
  value: unknown,
): GameConfig {
  const existing = config.assets[assetId];
  if (!existing) return config;
  return {
    ...config,
    assets: {
      ...config.assets,
      [assetId]: { ...existing, [field]: value },
    },
  };
}

/**
 * Derive the canonical userEdits path that a ConfigChange touches.
 *
 * Returns null if the change shape cannot be expressed as a single path
 * (currently: add_module / remove_module — they affect module structure,
 * not a specific field). For those, callers should fall back to a
 * module-level path (see preset-enricher).
 */
export function pathForConfigChange(
  change: {
    action: string;
    module_type?: string;
    param_key?: string;
    theme?: string;
    art_style?: string;
    duration?: number;
  },
  config: GameConfig,
): string | null {
  switch (change.action) {
    case 'set_theme':
      return 'meta.theme';
    case 'set_art_style':
      return 'meta.artStyle';
    case 'set_duration': {
      const timer = config.modules.find((m) => m.type === 'Timer');
      if (!timer) return null;
      return `modules[${timer.id}].params.duration`;
    }
    case 'set_param': {
      if (!change.module_type || change.param_key === undefined) return null;
      const mod = config.modules.find((m) => m.type === change.module_type);
      if (!mod) return null;
      return `modules[${mod.id}].params.${change.param_key}`;
    }
    default:
      return null;
  }
}
