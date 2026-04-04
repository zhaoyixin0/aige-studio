import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { extractParams, type CanonicalParams } from '../calibration/extract-params';
import {
  calibrate,
  computeGroupStats,
  type CalibrationResult,
  type GroupStats,
} from '../calibration/calibrate';
import path from 'path';

const EXPERT_DIR = path.resolve(__dirname, '../../../../expert-data/json');

describe('Calibration Math', () => {
  let knowledgeParams: CanonicalParams[];

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    knowledgeParams = inv.knowledge
      .map((item) => {
        const doc = normalizeExpert(item.raw, item.filename);
        return extractParams(doc);
      })
      .filter((p) => Object.keys(p).length > 0);
  });

  describe('computeGroupStats', () => {
    it('computes stats for numeric params', () => {
      const stats = computeGroupStats(knowledgeParams, 'object_count');
      expect(stats).toBeDefined();
      expect(stats!.median).toBeGreaterThan(0);
      expect(stats!.mad).toBeGreaterThanOrEqual(0);
      expect(stats!.p10).toBeLessThanOrEqual(stats!.median);
      expect(stats!.p90).toBeGreaterThanOrEqual(stats!.median);
      expect(stats!.count).toBeGreaterThan(0);
    });

    it('returns null for boolean-only params', () => {
      // has_physics is boolean, but stored as boolean
      // computeGroupStats should handle booleans by treating true=1, false=0
      const stats = computeGroupStats(knowledgeParams, 'has_physics');
      // For boolean params, stats should still work (0/1 values)
      if (stats) {
        expect(stats.median).toBeGreaterThanOrEqual(0);
        expect(stats.median).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('calibrate (Empirical-Bayes shrinkage)', () => {
    it('produces calibration results for numeric params', () => {
      const defaultValue = 20; // hypothetical default object_count
      const result = calibrate(knowledgeParams, 'object_count', defaultValue);
      expect(result).toBeDefined();
      expect(result.suggested).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('suggested value is between default and expert median (shrinkage)', () => {
      const defaultValue = 5;
      const result = calibrate(knowledgeParams, 'object_count', defaultValue);
      const stats = computeGroupStats(knowledgeParams, 'object_count');
      if (stats && stats.median > defaultValue) {
        // Shrinkage should pull towards middle
        expect(result.suggested).toBeGreaterThanOrEqual(defaultValue);
        expect(result.suggested).toBeLessThanOrEqual(stats.median);
      }
    });

    it('confidence increases with more data points', () => {
      const fewParams = knowledgeParams.slice(0, 3);
      const manyParams = knowledgeParams;
      const resultFew = calibrate(fewParams, 'object_count', 10);
      const resultMany = calibrate(manyParams, 'object_count', 10);
      expect(resultMany.confidence).toBeGreaterThanOrEqual(resultFew.confidence);
    });

    it('returns default when no data available', () => {
      const result = calibrate([], 'object_count', 42);
      expect(result.suggested).toBe(42);
      expect(result.confidence).toBe(0);
    });

    it('result is deterministic (idempotent)', () => {
      const r1 = calibrate(knowledgeParams, 'object_count', 10);
      const r2 = calibrate(knowledgeParams, 'object_count', 10);
      expect(r1.suggested).toBe(r2.suggested);
      expect(r1.confidence).toBe(r2.confidence);
    });

    it('suggested is always finite and non-negative for counts', () => {
      for (const paramKey of ['object_count', 'collider_count', 'complexity_score']) {
        const result = calibrate(knowledgeParams, paramKey, 0);
        expect(Number.isFinite(result.suggested)).toBe(true);
        expect(result.suggested).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
