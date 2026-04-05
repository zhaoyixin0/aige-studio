import { describe, it, expect } from 'vitest';
import {
  loadTaxonomy,
  type GameTypeEntry,
  type TaxonomyV2,
} from '../taxonomy/game-types-v2';

describe('Game Type Taxonomy v2', () => {
  let taxonomy: TaxonomyV2;

  beforeAll(() => {
    taxonomy = loadTaxonomy();
  });

  it('has 38 game types', () => {
    expect(taxonomy.types.length).toBe(38);
  });

  it('has 8 groups', () => {
    const groups = new Set(taxonomy.types.map((t) => t.group));
    expect(groups.size).toBe(8);
  });

  it('every type has required fields', () => {
    for (const t of taxonomy.types) {
      expect(t.id).toBeTruthy();
      expect(t.group).toBeTruthy();
      expect(t.displayName).toBeTruthy();
      expect(typeof t.supportedToday).toBe('boolean');
      expect(Array.isArray(t.requiredModules)).toBe(true);
    }
  });

  it('at least 33 types are supported today', () => {
    const supported = taxonomy.types.filter((t) => t.supportedToday);
    expect(supported.length).toBeGreaterThanOrEqual(33);
  });

  it('unsupported types list missingModules', () => {
    const unsupported = taxonomy.types.filter((t) => !t.supportedToday);
    for (const t of unsupported) {
      expect(t.missingModules.length).toBeGreaterThan(0);
    }
  });

  it('all existing AIGE game types are present', () => {
    const aigeTypes = [
      'catch', 'dodge', 'quiz', 'random-wheel', 'tap', 'shooting',
      'expression', 'runner', 'gesture', 'rhythm', 'puzzle',
      'dress-up', 'world-ar', 'narrative', 'platformer', 'action-rpg',
    ];
    const ids = new Set(taxonomy.types.map((t) => t.id));
    for (const gt of aigeTypes) {
      expect(ids.has(gt), `Missing AIGE type: ${gt}`).toBe(true);
    }
  });

  it('no duplicate IDs', () => {
    const ids = taxonomy.types.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every type has evidence string from expert data', () => {
    for (const t of taxonomy.types) {
      expect(typeof t.evidence).toBe('string');
    }
  });
});
