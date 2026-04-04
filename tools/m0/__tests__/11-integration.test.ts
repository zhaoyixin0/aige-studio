import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { extractParams } from '../calibration/extract-params';
import { calibrate } from '../calibration/calibrate';
import { buildPresetOverlays, applyOverlays } from '../calibration/apply-overlays';
import { loadTaxonomy } from '../taxonomy/game-types-v2';
import { buildCapabilityIndex } from '../taxonomy/module-capabilities';
import { buildRecipes } from '../recipes/from-expert';
import { generateGameTypeCards, generateRecipeCards } from '../cards/generate-cards';
import { computeFeelScore } from '../benchmark/feel-score';
import { ALL_GAME_TYPES, getGamePreset } from '../../../src/agent/game-presets';
import path from 'path';

const EXPERT_DIR = path.resolve(__dirname, '../../../../expert-data/json');

describe('M0 Integration Smoke Test', () => {
  it('full pipeline: inventory → normalize → extract → calibrate → overlay → taxonomy → recipes → cards → feel score', async () => {
    // 1. Load inventory
    const inv = await loadInventory(EXPERT_DIR);
    expect(inv.knowledge.length + inv.commands.length + inv.templates.length + inv.snapshots.length).toBe(80);

    // 2. Normalize all docs
    const allDocs = [
      ...inv.knowledge.map((i) => normalizeExpert(i.raw, i.filename)),
      ...inv.commands.map((i) => normalizeExpert(i.raw, i.filename)),
      ...inv.templates.map((i) => normalizeExpert(i.raw, i.filename)),
      ...inv.snapshots.map((i) => normalizeExpert(i.raw, i.filename)),
    ];
    expect(allDocs.length).toBe(80);

    // 3. Extract params from knowledge docs
    const knowledgeDocs = allDocs.filter((d) => d.kind === 'knowledge');
    const allParams = knowledgeDocs.map((d) => extractParams(d));
    expect(allParams.length).toBeGreaterThanOrEqual(40);

    // 4. Calibrate
    const objCountCal = calibrate(allParams, 'object_count', 10);
    expect(objCountCal.suggested).toBeGreaterThan(0);
    expect(objCountCal.confidence).toBeGreaterThan(0);

    // 5. Build overlays
    const knowledgeWithParams = inv.knowledge.map((i) => ({
      doc: normalizeExpert(i.raw, i.filename),
      params: extractParams(normalizeExpert(i.raw, i.filename)),
    }));
    const overlays = buildPresetOverlays(knowledgeWithParams);
    expect(overlays.length).toBeGreaterThanOrEqual(1);

    // 6. Apply overlays to base presets
    const basePresets: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const gt of ALL_GAME_TYPES) {
      basePresets[gt] = getGamePreset(gt) ?? {};
    }
    const merged = applyOverlays(basePresets, overlays);
    expect(Object.keys(merged).length).toBe(ALL_GAME_TYPES.length);

    // 7. Load taxonomy
    const taxonomy = loadTaxonomy();
    expect(taxonomy.types.length).toBe(38);

    // 8. Build capability index
    const capIndex = await buildCapabilityIndex();
    expect(Object.keys(capIndex).length).toBeGreaterThanOrEqual(55);

    // 9. Build recipes
    const commands = allDocs.filter((d) => d.kind === 'command');
    const templates = allDocs.filter((d) => d.kind === 'template');
    const recipes = buildRecipes(commands, templates);
    expect(recipes.length).toBeGreaterThanOrEqual(20);

    // 10. Generate cards
    const paramsByType = new Map<string, ReturnType<typeof extractParams>[]>();
    for (const doc of knowledgeDocs) {
      if (doc.kind !== 'knowledge') continue;
      const params = extractParams(doc);
      if (!paramsByType.has(doc.gameType)) paramsByType.set(doc.gameType, []);
      paramsByType.get(doc.gameType)!.push(params);
    }
    const gameTypeCards = generateGameTypeCards(taxonomy, paramsByType);
    const recipeCards = generateRecipeCards(recipes);
    expect(gameTypeCards.length).toBe(38);
    expect(recipeCards.length).toBeGreaterThanOrEqual(20);

    // 11. Compute feel score for 2 sample recipes
    const sampleRecipe1 = recipes[0];
    const score1 = computeFeelScore(
      { object_count: 15, collider_count: 5, has_physics: true },
      ['Collision', 'Spawner', 'Scorer', 'Timer'],
    );
    expect(score1.total).toBeGreaterThanOrEqual(0);
    expect(score1.total).toBeLessThanOrEqual(100);

    const score2 = computeFeelScore(
      { object_count: 30, collider_count: 10, has_physics: true, has_tween: true },
      ['Collision', 'Spawner', 'Scorer', 'Timer', 'Lives', 'Health', 'Gravity', 'DifficultyRamp'],
    );
    expect(score2.total).toBeGreaterThan(score1.total);
  });
});
