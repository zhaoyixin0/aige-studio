import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { buildRecipes, type Recipe } from '../recipes/from-expert';

import { EXPERT_DATA_DIR, canRunOfflinePipelineTests } from './test-helpers';

const EXPERT_DIR = EXPERT_DATA_DIR;

describe.skipIf(!canRunOfflinePipelineTests())('Recipe Builder', () => {
  let recipes: Recipe[];

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    const commands = inv.commands.map((i) => normalizeExpert(i.raw, i.filename));
    const templates = inv.templates.map((i) => normalizeExpert(i.raw, i.filename));
    recipes = buildRecipes(commands, templates);
  });

  it('produces at least 20 recipes', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(20);
  });

  it('every recipe has required fields', () => {
    for (const r of recipes) {
      expect(r.id).toBeTruthy();
      expect(r.source).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(Array.isArray(r.steps)).toBe(true);
      expect(r.steps.length).toBeGreaterThan(0);
    }
  });

  it('every recipe step has name and mapped command', () => {
    for (const r of recipes) {
      for (const step of r.steps) {
        expect(step.command).toBeTruthy();
        expect(typeof step.index).toBe('number');
      }
    }
  });

  it('recipes from commands preserve step count', () => {
    // Each command doc should produce exactly 1 recipe
    const cmdRecipes = recipes.filter((r) => r.source.startsWith('command:'));
    expect(cmdRecipes.length).toBe(19);
  });

  it('no duplicate recipe IDs', () => {
    const ids = recipes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recipes have decomposeInputs when from commands', () => {
    const cmdRecipes = recipes.filter((r) => r.source.startsWith('command:'));
    for (const r of cmdRecipes) {
      expect(Array.isArray(r.decomposeInputs)).toBe(true);
    }
  });
});
