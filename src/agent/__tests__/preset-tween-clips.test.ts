import { describe, it, expect } from 'vitest';
import { ALL_GAME_TYPES, getGamePreset } from '../game-presets';

/**
 * Verify that presets combining Spawner+Tween include bridge-compatible clip IDs,
 * and presets combining EnemyAI+Tween include death-fade clip.
 */

describe('Preset Tween Clip Alignment', () => {
  // Collect all presets that have both Spawner+Tween or EnemyAI+Tween
  const presetsWithSpawnerAndTween: Array<[string, Record<string, Record<string, unknown>>]> = [];
  const presetsWithEnemyAIAndTween: Array<[string, Record<string, Record<string, unknown>>]> = [];

  for (const gameType of ALL_GAME_TYPES) {
    const preset = getGamePreset(gameType);
    if (!preset) continue;
    if ('Spawner' in preset && 'Tween' in preset) {
      presetsWithSpawnerAndTween.push([gameType, preset]);
    }
    if ('EnemyAI' in preset && 'Tween' in preset) {
      presetsWithEnemyAIAndTween.push([gameType, preset]);
    }
  }

  describe('Spawner+Tween presets have spawn-in clip', () => {
    it.each(presetsWithSpawnerAndTween)(
      '%s has spawn-in clip',
      (_name, modules) => {
        const clips = (modules.Tween as any).clips as Array<{ id: string }>;
        const clipIds = clips.map((c) => c.id);
        expect(clipIds).toContain('spawn-in');
      },
    );
  });

  describe('EnemyAI+Tween presets have death-fade clip', () => {
    if (presetsWithEnemyAIAndTween.length === 0) {
      it('no presets currently combine EnemyAI+Tween (placeholder)', () => {
        expect(presetsWithEnemyAIAndTween).toHaveLength(0);
      });
    } else {
      it.each(presetsWithEnemyAIAndTween)(
        '%s has death-fade clip',
        (_name, modules) => {
          const clips = (modules.Tween as any).clips as Array<{ id: string }>;
          const clipIds = clips.map((c) => c.id);
          expect(clipIds).toContain('death-fade');
        },
      );
    }
  });
});
