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

export const HERO_PRESETS: readonly PresetTemplate[] = Object.values(heroPresetFiles) as PresetTemplate[];

/**
 * Create a PresetRegistry pre-loaded with all hero presets.
 */
export function createHeroRegistry(): _PresetRegistry {
  const registry = new _PresetRegistry();
  registry.registerAll(HERO_PRESETS);
  return registry;
}
