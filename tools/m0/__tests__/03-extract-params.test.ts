import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { extractParams, CANONICAL_PARAMS, type CanonicalParams } from '../calibration/extract-params';
import path from 'path';

const EXPERT_DIR = path.resolve(__dirname, '../../../../expert-data/json');

describe('Parameter Extractor', () => {
  let allNormalized: Array<{ filename: string; doc: ReturnType<typeof normalizeExpert> }>;

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    const allItems = [
      ...inv.knowledge,
      ...inv.commands,
      ...inv.templates,
      ...inv.snapshots,
    ];
    allNormalized = allItems.map((item) => ({
      filename: item.filename,
      doc: normalizeExpert(item.raw, item.filename),
    }));
  });

  it('CANONICAL_PARAMS defines at least 10 known params', () => {
    expect(Object.keys(CANONICAL_PARAMS).length).toBeGreaterThanOrEqual(10);
  });

  it('extracts params from all docs without throwing', () => {
    for (const { doc } of allNormalized) {
      expect(() => extractParams(doc)).not.toThrow();
    }
  });

  it('all extracted keys are in canonical vocabulary', () => {
    const validKeys = new Set(Object.keys(CANONICAL_PARAMS));
    for (const { doc } of allNormalized) {
      const params = extractParams(doc);
      for (const key of Object.keys(params)) {
        expect(validKeys.has(key), `Unknown param key: ${key}`).toBe(true);
      }
    }
  });

  it('knowledge docs extract object_count and component info', () => {
    const mazeDoc = allNormalized.find((d) => d.filename === 'MazeChase_knowledge.json');
    expect(mazeDoc).toBeDefined();
    const params = extractParams(mazeDoc!.doc);
    expect(params.object_count).toBeGreaterThan(0);
    expect(params.has_physics).toBe(true);
    expect(params.has_box_collider).toBe(true);
  });

  it('command docs extract step_count and decompose_inputs', () => {
    const cmdDoc = allNormalized.find((d) => d.filename === '2D_Bounded_Area_Bounce_Game.json');
    expect(cmdDoc).toBeDefined();
    const params = extractParams(cmdDoc!.doc);
    expect(params.step_count).toBeGreaterThan(0);
    expect(params.input_count).toBeGreaterThan(0);
  });

  it('physics game types have has_physics = true', () => {
    const mazeDoc = allNormalized.find((d) => d.filename === 'MazeChase_knowledge.json');
    const params = extractParams(mazeDoc!.doc);
    expect(params.has_physics).toBe(true);
  });

  it('returns only number or boolean values', () => {
    for (const { doc } of allNormalized) {
      const params = extractParams(doc);
      for (const [key, val] of Object.entries(params)) {
        expect(
          typeof val === 'number' || typeof val === 'boolean',
          `${key} has invalid type: ${typeof val}`,
        ).toBe(true);
      }
    }
  });

  it('at least 50% of knowledge docs extract >= 3 params', () => {
    const knowledgeDocs = allNormalized.filter((d) => d.doc.kind === 'knowledge');
    const rich = knowledgeDocs.filter((d) => Object.keys(extractParams(d.doc)).length >= 3);
    expect(rich.length / knowledgeDocs.length).toBeGreaterThanOrEqual(0.5);
  });
});
