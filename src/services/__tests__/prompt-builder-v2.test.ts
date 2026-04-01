// src/services/__tests__/prompt-builder-v2.test.ts
// TDD RED: Tests for the upgraded PromptBuilder with skill-based prompts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../prompt-builder';

describe('PromptBuilder v2 — enhanced prompts', () => {
  describe('white outline buffer requirement', () => {
    it('should include white outline instruction for sprite prompts', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).toContain('white outline');
    });

    it('should include white outline for player prompts', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'ocean', role: 'player', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).toContain('white outline');
    });

    it('should NOT include white outline for background prompts', () => {
      const prompt = PromptBuilder.build('background', {
        gameType: 'catch', theme: 'space', role: 'background', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).not.toContain('white outline');
    });
  });

  describe('anti-green-in-sprite instruction', () => {
    it('should warn against using #00FF00 inside sprites', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      // Should instruct not to use #00FF00 in the sprite itself
      expect(prompt).toMatch(/do not use.*#00FF00.*inside|#006400|#32CD32/i);
    });
  });

  describe('mobile readability hint', () => {
    it('should mention pixel readability for sprites', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      // Should mention readability at small pixel size
      expect(prompt).toMatch(/readable.*\d+x\d+\s*pixel|recognizable.*\d+x\d+/i);
    });

    it('should mention readability for player character', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'ocean', role: 'player', style: 'cartoon',
      });
      expect(prompt).toMatch(/readable.*\d+x\d+|recognizable.*\d+x\d+/i);
    });
  });

  describe('style consistency anchor', () => {
    it('should include cohesive set language for sprites', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).toContain('cohesive');
    });

    it('should include cohesive set language for backgrounds', () => {
      const prompt = PromptBuilder.build('background', {
        gameType: 'catch', theme: 'space', role: 'background', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).toContain('cohesive');
    });
  });

  describe('enhanced style descriptors', () => {
    it('cartoon style should include specific rendering details', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'fruit', role: 'player', style: 'cartoon',
      });
      // Should have detailed style descriptor, not just "cartoon style"
      expect(prompt).toMatch(/bold.*outline|cel-shaded|vibrant.*color/i);
    });

    it('pixel style should mention retro/8-bit', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'space', role: 'good', style: 'pixel',
      });
      expect(prompt).toMatch(/pixel art|retro|8-bit/i);
    });

    it('chibi style should mention kawaii/oversized head', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'candy', role: 'player', style: 'chibi',
      });
      expect(prompt).toMatch(/chibi|kawaii|oversized.*head|super-deformed/i);
    });
  });

  describe('enhanced theme aesthetics', () => {
    it('fruit theme should have detailed visual description', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      // Should have more than just "colorful, juicy"
      expect(prompt.length).toBeGreaterThan(200);
    });

    it('space theme should mention cosmic/nebula details', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'space', role: 'good', style: 'cartoon',
      });
      expect(prompt).toMatch(/cosmic|nebula|starfield|neon/i);
    });
  });

  describe('role-specific prompt quality', () => {
    it('collectible prompt should mention appealing/rewarding', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      expect(prompt).toMatch(/appealing|reward|desirable|valuable/i);
    });

    it('obstacle prompt should mention danger/menacing', () => {
      const prompt = PromptBuilder.build('bad_1', {
        gameType: 'dodge', theme: 'space', role: 'bad', style: 'cartoon',
      });
      expect(prompt).toMatch(/danger|menac|harm|threat/i);
    });

    it('player prompt should mention friendly/heroic', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'ocean', role: 'player', style: 'cartoon',
      });
      expect(prompt).toMatch(/friendly|hero|express|invit/i);
    });

    it('bullet prompt should mention energetic/dynamic', () => {
      const prompt = PromptBuilder.build('bullet', {
        gameType: 'shooting', theme: 'space', role: 'bullet', style: 'cartoon',
      });
      expect(prompt).toMatch(/energetic|dynamic|fast|momentum/i);
    });

    it('background prompt should NOT have green screen requirement', () => {
      const prompt = PromptBuilder.build('background', {
        gameType: 'catch', theme: 'ocean', role: 'background', style: 'cartoon',
      });
      expect(prompt).not.toContain('#00FF00');
      expect(prompt).toMatch(/fill.*canvas|edge to edge/i);
    });
  });

  describe('composition specifications', () => {
    it('sprite should specify canvas occupation percentage', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      expect(prompt).toMatch(/\d+(-|–)\d+%\s*(of|canvas)/i);
    });

    it('should specify single object centered', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch', theme: 'fruit', role: 'good', style: 'cartoon',
      });
      expect(prompt.toLowerCase()).toContain('centered');
      expect(prompt).toMatch(/single (object|item|sprite|character)/i);
    });

    it('should specify no cropping', () => {
      const prompt = PromptBuilder.build('player', {
        gameType: 'catch', theme: 'fruit', role: 'player', style: 'cartoon',
      });
      expect(prompt).toMatch(/no crop|fully visible|within frame/i);
    });
  });

  describe('custom asset descriptions from LLM', () => {
    it('should prioritize custom descriptions over theme defaults', () => {
      const prompt = PromptBuilder.build('good_1', {
        gameType: 'catch',
        theme: 'fruit',
        role: 'good',
        style: 'cartoon',
        assetDescriptions: { good_1: 'a magical flying pineapple with wings' },
      });
      expect(prompt).toContain('magical flying pineapple');
      // Should NOT contain the default "strawberry"
      expect(prompt).not.toContain('strawberry');
    });
  });

  describe('getImageConfig helper', () => {
    it('should return 1:1 and 1K for sprite roles', () => {
      const config = PromptBuilder.getImageConfig('good');
      expect(config.aspectRatio).toBe('1:1');
      expect(config.imageSize).toBe('1K');
    });

    it('should return 9:16 and 1K for background role', () => {
      const config = PromptBuilder.getImageConfig('background');
      expect(config.aspectRatio).toBe('9:16');
      expect(config.imageSize).toBe('1K');
    });

    it('should return 1:1 for player role', () => {
      const config = PromptBuilder.getImageConfig('player');
      expect(config.aspectRatio).toBe('1:1');
    });

    it('should return 1:1 for bullet role', () => {
      const config = PromptBuilder.getImageConfig('bullet');
      expect(config.aspectRatio).toBe('1:1');
    });
  });
});
