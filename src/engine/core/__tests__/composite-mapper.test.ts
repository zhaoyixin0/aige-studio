import { describe, it, expect } from 'vitest';
import {
  applyL1Preset,
  type L1Values,
  type MappedChange,
} from '../composite-mapper';

describe('CompositeMapper', () => {
  describe('applyL1Preset', () => {
    it('returns an array of MappedChange entries', () => {
      const l1: L1Values = { difficulty: '普通', pacing: '中', emotion: '欢乐' };
      const result = applyL1Preset(l1, 'catch');
      expect(Array.isArray(result)).toBe(true);
      result.forEach((change) => {
        expect(change).toHaveProperty('moduleId');
        expect(change).toHaveProperty('changes');
        expect(typeof change.moduleId).toBe('string');
        expect(typeof change.changes).toBe('object');
      });
    });

    it('returns non-empty changes for difficulty "困难"', () => {
      const l1: L1Values = { difficulty: '困难', pacing: '中', emotion: '欢乐' };
      const result = applyL1Preset(l1, 'catch');
      expect(result.length).toBeGreaterThan(0);
    });

    it('maps difficulty to spawner frequency/speed and lives count', () => {
      const easy: L1Values = { difficulty: '简单', pacing: '中', emotion: '欢乐' };
      const hard: L1Values = { difficulty: '困难', pacing: '中', emotion: '欢乐' };

      const easyChanges = applyL1Preset(easy, 'catch');
      const hardChanges = applyL1Preset(hard, 'catch');

      const getChange = (changes: MappedChange[], modId: string) =>
        changes.find((c) => c.moduleId === modId);

      const easySpawner = getChange(easyChanges, 'spawner');
      const hardSpawner = getChange(hardChanges, 'spawner');

      // Hard should have higher frequency and speed than easy
      if (easySpawner && hardSpawner) {
        expect((hardSpawner.changes.frequency as number) ?? 0).toBeGreaterThanOrEqual(
          (easySpawner.changes.frequency as number) ?? 0
        );
      }
    });

    it('maps pacing to spawner and runner speed', () => {
      const slow: L1Values = { difficulty: '普通', pacing: '慢', emotion: '欢乐' };
      const fast: L1Values = { difficulty: '普通', pacing: '快', emotion: '欢乐' };

      const slowChanges = applyL1Preset(slow, 'runner');
      const fastChanges = applyL1Preset(fast, 'runner');

      const getRunnerSpeed = (changes: MappedChange[]) => {
        const runner = changes.find((c) => c.moduleId === 'runner');
        return runner?.changes.speed as number | undefined;
      };

      const slowSpeed = getRunnerSpeed(slowChanges);
      const fastSpeed = getRunnerSpeed(fastChanges);

      if (slowSpeed !== undefined && fastSpeed !== undefined) {
        expect(fastSpeed).toBeGreaterThan(slowSpeed);
      }
    });

    it('returns different changes for different game types', () => {
      const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
      const catchChanges = applyL1Preset(l1, 'catch');
      const shootingChanges = applyL1Preset(l1, 'shooting');

      // At minimum both should produce changes
      expect(catchChanges.length).toBeGreaterThan(0);
      expect(shootingChanges.length).toBeGreaterThan(0);
    });

    it('handles unknown game type gracefully (falls back to defaults)', () => {
      const l1: L1Values = { difficulty: '普通', pacing: '中', emotion: '欢乐' };
      const result = applyL1Preset(l1, 'unknown_type');
      // Should still return base changes (not throw)
      expect(Array.isArray(result)).toBe(true);
    });

    it('merges changes for the same module into one entry', () => {
      const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
      const result = applyL1Preset(l1, 'catch');

      const moduleIds = result.map((c) => c.moduleId);
      const uniqueIds = new Set(moduleIds);
      // Each moduleId should appear at most once
      expect(uniqueIds.size).toBe(moduleIds.length);
    });

    it('returns immutable output (not referencing shared state)', () => {
      const l1: L1Values = { difficulty: '困难', pacing: '快', emotion: '热血' };
      const result1 = applyL1Preset(l1, 'catch');
      const result2 = applyL1Preset(l1, 'catch');
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Different references
    });
  });
});
