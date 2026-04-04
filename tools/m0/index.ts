// tools/m0/index.ts
// M0 Knowledge Application Layer — barrel exports

export { loadInventory, type Inventory, type InventoryItem } from './io/expert-inventory';
export { normalizeExpert, isKnowledge, isCommand, isTemplate, isSnapshot } from './schema/guards';
export type { NormalizedExpert } from './schema/guards';
export type {
  ExpertKnowledge,
  ExpertCommand,
  ExpertTemplate,
  ExpertSnapshot,
  SceneNode,
  CommandStep,
} from './schema/expert-types';
export { extractParams, CANONICAL_PARAMS, type CanonicalParams } from './calibration/extract-params';
export { calibrate, computeGroupStats, type CalibrationResult, type GroupStats } from './calibration/calibrate';
export { buildPresetOverlays, applyOverlays, type PresetOverlay } from './calibration/apply-overlays';
export { loadTaxonomy, type GameTypeEntry, type TaxonomyV2 } from './taxonomy/game-types-v2';
export { buildCapabilityIndex, type CapabilityIndex } from './taxonomy/module-capabilities';
export { buildRecipes } from './recipes/from-expert';
export type { Recipe, RecipeStep } from './recipes/recipe-types';
export {
  generateGameTypeCards,
  generateRecipeCards,
  type GameTypeCard,
  type RecipeCard,
} from './cards/generate-cards';
export { computeFeelScore, DIMENSIONS, type FeelScoreResult } from './benchmark/feel-score';

// Namespace re-exports for backward compat with smoke test
export const inventory = {};
export const calibration = {};
export const taxonomy = {};
export const recipes = {};
export const cards = {};
export const feelScore = {};
