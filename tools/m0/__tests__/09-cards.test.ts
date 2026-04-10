import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { extractParams } from '../calibration/extract-params';
import { calibrate } from '../calibration/calibrate';
import { buildRecipes } from '../recipes/from-expert';
import { loadTaxonomy } from '../taxonomy/game-types-v2';
import {
  generateGameTypeCards,
  generateRecipeCards,
  type GameTypeCard,
  type RecipeCard,
} from '../cards/generate-cards';
import { EXPERT_DATA_DIR, canRunOfflinePipelineTests } from './test-helpers';

const EXPERT_DIR = EXPERT_DATA_DIR;

describe.skipIf(!canRunOfflinePipelineTests())('Knowledge Cards Generator', () => {
  let gameTypeCards: GameTypeCard[];
  let recipeCards: RecipeCard[];

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    const taxonomy = loadTaxonomy();

    // Build param groups per AIGE type
    const knowledgeDocs = inv.knowledge.map((i) => normalizeExpert(i.raw, i.filename));
    const paramsByType = new Map<string, ReturnType<typeof extractParams>[]>();
    for (const doc of knowledgeDocs) {
      if (doc.kind !== 'knowledge') continue;
      const params = extractParams(doc);
      if (!paramsByType.has(doc.gameType)) paramsByType.set(doc.gameType, []);
      paramsByType.get(doc.gameType)!.push(params);
    }

    gameTypeCards = generateGameTypeCards(taxonomy, paramsByType);

    const commands = inv.commands.map((i) => normalizeExpert(i.raw, i.filename));
    const templates = inv.templates.map((i) => normalizeExpert(i.raw, i.filename));
    const recipes = buildRecipes(commands, templates);
    recipeCards = generateRecipeCards(recipes);
  });

  it('generates 38 game-type cards', () => {
    expect(gameTypeCards.length).toBe(38);
  });

  it('every game-type card has required fields', () => {
    for (const card of gameTypeCards) {
      expect(card.id).toBeTruthy();
      expect(card.displayName).toBeTruthy();
      expect(card.group).toBeTruthy();
      expect(typeof card.supportedToday).toBe('boolean');
      expect(Array.isArray(card.topModules)).toBe(true);
    }
  });

  it('generates recipe cards for all recipes', () => {
    expect(recipeCards.length).toBeGreaterThanOrEqual(20);
  });

  it('every recipe card has steps and description', () => {
    for (const card of recipeCards) {
      expect(card.id).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.stepCount).toBeGreaterThan(0);
      expect(card.complexity).toBeTruthy();
    }
  });

  it('no duplicate card IDs across all cards', () => {
    const allIds = [...gameTypeCards.map((c) => c.id), ...recipeCards.map((c) => c.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
