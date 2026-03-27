import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../skill-loader';

describe('SkillLoader', () => {
  /* ------------------------------------------------------------------ */
  /*  Existing methods — baseline sanity                                 */
  /* ------------------------------------------------------------------ */

  describe('load', () => {
    it('loads a knowledge markdown file by path', async () => {
      const loader = new SkillLoader();
      const content = await loader.load('game-types/catch.md');
      expect(content).toContain('接住');
    });

    it('throws on non-existent path', async () => {
      const loader = new SkillLoader();
      await expect(loader.load('nonexistent.md')).rejects.toThrow('Skill not found');
    });

    it('caches loaded content', async () => {
      const loader = new SkillLoader();
      const first = await loader.load('game-types/catch.md');
      const second = await loader.load('game-types/catch.md');
      expect(first).toBe(second); // same reference = cached
    });
  });

  /* ------------------------------------------------------------------ */
  /*  findCategory — CameraFollow fix                                    */
  /* ------------------------------------------------------------------ */

  describe('findCategory', () => {
    it('classifies CameraFollow as feedback', async () => {
      const loader = new SkillLoader();
      // loadModuleDoc depends on findCategory, so test via loadModuleDoc
      const doc = await loader.loadModuleDoc('CameraFollow');
      expect(doc).toContain('CameraFollow');
    });

    it('classifies TouchInput as input', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('TouchInput');
      expect(doc).toContain('TouchInput');
    });

    it('classifies Collision as mechanic', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('Collision');
      expect(doc).toContain('Collision');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  loadModuleDoc — PascalCase → kebab-case                            */
  /* ------------------------------------------------------------------ */

  describe('loadModuleDoc', () => {
    it('converts PascalCase to kebab-case for file lookup', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('EnemyAI');
      expect(doc).toContain('EnemyAI');
      expect(doc.length).toBeGreaterThan(100);
    });

    it('handles multi-word module names', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('WaveSpawner');
      expect(doc).toContain('WaveSpawner');
    });

    it('handles single-word module names', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('Scorer');
      expect(doc).toContain('Scorer');
    });

    it('handles IFrames edge case', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('IFrames');
      expect(doc).toContain('IFrames');
    });

    it('returns empty string for non-existent module', async () => {
      const loader = new SkillLoader();
      const doc = await loader.loadModuleDoc('NonExistentModule');
      expect(doc).toBe('');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  loadForConversation — dynamic knowledge loading                    */
  /* ------------------------------------------------------------------ */

  describe('loadForConversation', () => {
    it('loads game type doc when game type is provided', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('shooting', []);
      expect(result).toContain('射击');
    });

    it('returns empty string when game type is null and no modules', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation(null, []);
      expect(result).toBe('');
    });

    it('returns empty string for non-existent game type with no modules', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('nonexistent-type', []);
      expect(result).toBe('');
    });

    it('includes wiring content when modules are provided', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('shooting', [
        'Projectile', 'EnemyAI', 'Collision',
      ]);
      // Should include shooting game doc
      expect(result).toContain('射击');
      // Should include wiring content related to these modules
      expect(result.length).toBeGreaterThan(500);
    });

    it('includes synergies content when modules are provided', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('catch', [
        'Spawner', 'Collision', 'Scorer',
      ]);
      // Should include synergy for Spawner+Collision+Scorer
      expect(result).toContain('Spawner');
      expect(result).toContain('Scorer');
    });

    it('filters wiring to only include sections mentioning current modules', async () => {
      const loader = new SkillLoader();
      // Load with only Timer and Lives
      const result = await loader.loadForConversation(null, ['Timer', 'Lives']);
      // Must have content (Timer and Lives appear in wiring doc)
      expect(result).not.toBe('');
      expect(result).toContain('Timer');
      // Should NOT include unrelated sections (e.g., QuizEngine, Randomizer)
      expect(result).not.toContain('QuizEngine');
      expect(result).not.toContain('Randomizer');
    });

    it('filters synergies to only include entries with current modules', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation(null, ['Timer', 'DifficultyRamp']);
      // Must have content
      expect(result).not.toBe('');
      // Should include Timer + DifficultyRamp synergy
      expect(result).toContain('DifficultyRamp');
      // Should NOT include unrelated synergies
      expect(result).not.toContain('QuizEngine');
    });

    it('separates sections with ---', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('catch', [
        'Spawner', 'Collision', 'Scorer',
      ]);
      // Multiple sections should be joined with ---
      expect(result).toContain('---');
    });

    it('handles all 16 game types without error', async () => {
      const loader = new SkillLoader();
      const gameTypes = [
        'catch', 'dodge', 'tap', 'shooting', 'quiz', 'random-wheel',
        'expression', 'runner', 'gesture', 'rhythm', 'puzzle',
        'dress-up', 'world-ar', 'narrative', 'platformer', 'action-rpg',
      ];
      for (const gt of gameTypes) {
        const result = await loader.loadForConversation(gt, []);
        expect(result.length).toBeGreaterThan(100, `game type ${gt} should have content`);
      }
    });
  });
});
