import { describe, it, expect } from 'vitest';
import {
  computeFeelScore,
  DIMENSIONS,
  type FeelScoreResult,
} from '../benchmark/feel-score';
import type { CanonicalParams } from '../calibration/extract-params';

describe('Game Feel Score Engine', () => {
  it('defines 8 dimensions', () => {
    expect(DIMENSIONS.length).toBe(8);
  });

  it('each dimension has name, weight, and description', () => {
    for (const dim of DIMENSIONS) {
      expect(dim.name).toBeTruthy();
      expect(dim.weight).toBeGreaterThan(0);
      expect(dim.description).toBeTruthy();
    }
  });

  it('dimension weights sum to 1', () => {
    const sum = DIMENSIONS.reduce((s, d) => s + d.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  describe('computeFeelScore', () => {
    it('returns score in range [0, 100]', () => {
      const params: CanonicalParams = { object_count: 15, collider_count: 5, has_physics: true };
      const modules = ['Collision', 'Spawner', 'Scorer', 'Timer'];
      const result = computeFeelScore(params, modules);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('returns per-dimension scores', () => {
      const params: CanonicalParams = { object_count: 20, collider_count: 8 };
      const result = computeFeelScore(params, ['Collision', 'Health', 'EnemyAI']);
      expect(Object.keys(result.dimensions).length).toBe(8);
      for (const [_, score] of Object.entries(result.dimensions)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it('higher module count increases score', () => {
      const params: CanonicalParams = { object_count: 10 };
      const few = computeFeelScore(params, ['Scorer']);
      const many = computeFeelScore(params, ['Scorer', 'Collision', 'Timer', 'Lives', 'Spawner', 'DifficultyRamp']);
      expect(many.total).toBeGreaterThanOrEqual(few.total);
    });

    it('physics presence boosts score', () => {
      const base: CanonicalParams = { object_count: 10, collider_count: 3 };
      const noPhysics = computeFeelScore({ ...base, has_physics: false }, ['Collision']);
      const withPhysics = computeFeelScore({ ...base, has_physics: true }, ['Collision', 'Gravity']);
      expect(withPhysics.total).toBeGreaterThanOrEqual(noPhysics.total);
    });

    it('result is deterministic', () => {
      const params: CanonicalParams = { object_count: 15 };
      const mods = ['Collision', 'Spawner'];
      const r1 = computeFeelScore(params, mods);
      const r2 = computeFeelScore(params, mods);
      expect(r1.total).toBe(r2.total);
    });

    it('empty params/modules returns minimum score', () => {
      const result = computeFeelScore({}, []);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThan(30); // Very low for empty
    });

    it('returns badge based on score', () => {
      const params: CanonicalParams = { object_count: 30, collider_count: 10, has_physics: true, has_tween: true };
      const result = computeFeelScore(params, [
        'Collision', 'Spawner', 'Scorer', 'Timer', 'Lives', 'Health',
        'Gravity', 'DifficultyRamp', 'ParticleVFX', 'SoundFX',
      ]);
      expect(['bronze', 'silver', 'gold', 'expert']).toContain(result.badge);
    });
  });
});
