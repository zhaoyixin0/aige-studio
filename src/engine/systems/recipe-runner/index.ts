export { RecipeExecutor } from './recipe-executor';
export type { ExecutorResult } from './recipe-executor';
export { PresetRegistry } from './preset-registry';
export { validateCommand, validateParamValue, validateSequence } from './validators';
export type {
  ParamType,
  ParamSpec,
  CommandName,
  Command,
  CommandSequence,
  PresetTemplate,
  ValidationError,
  ValidationResult,
} from './types';

// ── Hero Presets ──

import { PresetRegistry as _PresetRegistry } from './preset-registry';
import type { PresetTemplate } from './types';

const heroPresetFiles = import.meta.glob('/src/knowledge/recipes-runner/*.preset.json', {
  eager: true,
  import: 'default',
});

// Split hero preset JSON files by format:
//   - kind==='hero-skeleton' → routed through hero-preset-loader (new path)
//   - otherwise              → legacy PresetTemplate, stays on RecipeExecutor
function isSkeletonRecord(v: unknown): v is { id: string; kind: 'hero-skeleton' } {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    (v as Record<string, unknown>).kind === 'hero-skeleton' &&
    typeof (v as Record<string, unknown>).id === 'string'
  );
}

const _heroRaw = Object.values(heroPresetFiles) as unknown[];

export const HERO_PRESETS: readonly PresetTemplate[] = _heroRaw.filter(
  (v): v is PresetTemplate => !isSkeletonRecord(v),
);

export const HERO_SKELETON_PRESETS: Readonly<Record<string, unknown>> = (() => {
  const out: Record<string, unknown> = {};
  for (const v of _heroRaw) {
    if (isSkeletonRecord(v)) {
      out[v.id] = v;
    }
  }
  return out;
})();

/**
 * Create a PresetRegistry pre-loaded with all legacy hero presets.
 * Hero-skeleton presets are not registered here — they are resolved via
 * HERO_SKELETON_PRESETS in the facade.
 */
export function createHeroRegistry(): _PresetRegistry {
  const registry = new _PresetRegistry();
  registry.registerAll(HERO_PRESETS);
  return registry;
}

// ── Expert Presets ──

const expertPresetFiles = import.meta.glob(
  '/src/knowledge/recipes-runner/experts/*.preset.json',
  { eager: true, import: 'default' },
);

export const EXPERT_PRESETS: readonly PresetTemplate[] =
  Object.values(expertPresetFiles) as PresetTemplate[];

/**
 * Create a PresetRegistry pre-loaded with all expert presets.
 */
export function createExpertRegistry(): _PresetRegistry {
  const registry = new _PresetRegistry();
  registry.registerAll(EXPERT_PRESETS);
  return registry;
}
