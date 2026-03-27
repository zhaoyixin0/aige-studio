import { describe, it, expect } from 'vitest';
import { generateSuggestions, type Chip } from '../conversation-agent';

describe('generateSuggestions', () => {
  /** Helper: extract module type IDs from chips */
  function moduleIds(chips: Chip[]): string[] {
    return chips
      .filter((c) => c.id.startsWith('add:'))
      .map((c) => c.id.replace('add:', ''));
  }

  it('should return chips array with max 8 items', () => {
    const chips = generateSuggestions([], 'catch');
    expect(chips.length).toBeLessThanOrEqual(8);
    expect(chips.length).toBeGreaterThan(0);
  });

  it('should not suggest modules already in currentModules', () => {
    const chips = generateSuggestions(['Timer', 'Lives', 'DifficultyRamp'], 'catch');
    const ids = moduleIds(chips);
    expect(ids).not.toContain('Timer');
    expect(ids).not.toContain('Lives');
    expect(ids).not.toContain('DifficultyRamp');
  });

  it('should include theme change suggestions', () => {
    const chips = generateSuggestions([], 'catch');
    const themeChips = chips.filter((c) => c.id.startsWith('theme:'));
    expect(themeChips.length).toBeGreaterThanOrEqual(1);
    expect(themeChips.length).toBeLessThanOrEqual(2);
  });

  it('should include art style suggestion', () => {
    const chips = generateSuggestions([], 'catch');
    const styleChips = chips.filter((c) => c.id.startsWith('style:'));
    expect(styleChips.length).toBe(1);
  });

  // --- Game-type-aware filtering (NEW) ---

  describe('game-type-aware module suggestions', () => {
    it('should prioritize shooter modules for shooting game type', () => {
      // shooting games already have Projectile, Aim, EnemyAI, etc.
      // should suggest Shield, BulletPattern, ComboSystem, DifficultyRamp
      const shooterModules = [
        'GameFlow', 'PlayerMovement', 'Projectile', 'Aim', 'EnemyAI',
        'WaveSpawner', 'Collision', 'Scorer', 'Health', 'Lives', 'IFrames',
        'UIOverlay', 'ResultScreen', 'TouchInput',
      ];
      const chips = generateSuggestions(shooterModules, 'shooting');
      const ids = moduleIds(chips);

      // Should suggest combat-relevant modules, not platformer modules
      expect(ids).toContain('Shield');
      expect(ids).toContain('BulletPattern');
      expect(ids).not.toContain('StaticPlatform');
      expect(ids).not.toContain('Collectible');
    });

    it('should prioritize RPG modules for action-rpg game type', () => {
      const rpgModules = [
        'GameFlow', 'PlayerMovement', 'Gravity', 'Jump', 'Projectile', 'Aim',
        'EnemyAI', 'WaveSpawner', 'Health', 'LevelUp', 'EnemyDrop',
        'Collision', 'Scorer', 'Lives', 'UIOverlay', 'ResultScreen', 'TouchInput',
      ];
      const chips = generateSuggestions(rpgModules, 'action-rpg');
      const ids = moduleIds(chips);

      // Should suggest RPG progression modules
      expect(ids).toContain('SkillTree');
      expect(ids).toContain('EquipmentSlot');
      expect(ids).toContain('StatusEffect');
      // Should not suggest platformer-specific modules
      expect(ids).not.toContain('StaticPlatform');
      expect(ids).not.toContain('CrumblingPlatform');
    });

    it('should prioritize platformer modules for platformer game type', () => {
      const platformerModules = [
        'GameFlow', 'PlayerMovement', 'Jump', 'Gravity', 'StaticPlatform',
        'Scorer', 'UIOverlay', 'ResultScreen', 'TouchInput',
      ];
      const chips = generateSuggestions(platformerModules, 'platformer');
      const ids = moduleIds(chips);

      // Should suggest platformer-relevant modules
      expect(ids).toContain('MovingPlatform');
      expect(ids).toContain('CrumblingPlatform');
      expect(ids).toContain('Dash');
      // Should not suggest shooter-specific modules
      expect(ids).not.toContain('BulletPattern');
      expect(ids).not.toContain('EnemyAI');
    });

    it('should suggest generic modules for simple game types', () => {
      const catchModules = [
        'GameFlow', 'Spawner', 'Collision', 'Scorer', 'UIOverlay',
        'ResultScreen', 'TouchInput',
      ];
      const chips = generateSuggestions(catchModules, 'catch');
      const ids = moduleIds(chips);

      // Should suggest universally useful modules
      expect(ids).toContain('Timer');
      expect(ids).toContain('Lives');
      expect(ids).toContain('DifficultyRamp');
      expect(ids).toContain('ComboSystem');
    });
  });

  // --- Batch 2/3 modules present in suggestions (NEW) ---

  describe('Batch 2/3 module availability', () => {
    it('should include Health in suggestions when not present', () => {
      const chips = generateSuggestions(['GameFlow'], 'shooting');
      const ids = moduleIds(chips);
      expect(ids).toContain('Health');
    });

    it('should include Shield in suggestions when not present', () => {
      const chips = generateSuggestions(['GameFlow', 'Health'], 'shooting');
      const ids = moduleIds(chips);
      expect(ids).toContain('Shield');
    });

    it('should include LevelUp in suggestions for RPG types', () => {
      const chips = generateSuggestions(['GameFlow'], 'action-rpg');
      const ids = moduleIds(chips);
      expect(ids).toContain('LevelUp');
    });

    it('should include EnemyDrop in suggestions for RPG types', () => {
      const chips = generateSuggestions(['GameFlow'], 'action-rpg');
      const ids = moduleIds(chips);
      expect(ids).toContain('EnemyDrop');
    });

    it('should include SkillTree in suggestions for RPG types', () => {
      const rpgModules = [
        'GameFlow', 'PlayerMovement', 'Projectile', 'Aim', 'EnemyAI',
        'WaveSpawner', 'Health', 'LevelUp', 'EnemyDrop', 'Collision',
        'Scorer', 'Lives',
      ];
      const chips = generateSuggestions(rpgModules, 'action-rpg');
      const ids = moduleIds(chips);
      expect(ids).toContain('SkillTree');
    });
  });

  // --- Each chip has required fields ---

  it('should have id, label on every chip', () => {
    const chips = generateSuggestions([], 'catch');
    for (const chip of chips) {
      expect(chip.id).toBeTruthy();
      expect(chip.label).toBeTruthy();
    }
  });

  it('should have emoji on module suggestion chips', () => {
    const chips = generateSuggestions([], 'catch');
    const moduleChips = chips.filter((c) => c.id.startsWith('add:'));
    for (const chip of moduleChips) {
      expect(chip.emoji).toBeTruthy();
    }
  });

  // --- Edge cases (T-2) ---

  describe('edge cases', () => {
    it('should fall back to simple category for unknown gameType', () => {
      const chips = generateSuggestions([], 'unknown-type-xyz');
      const ids = moduleIds(chips);
      // Should get simple-category suggestions (Timer, Lives, etc.)
      expect(ids).toContain('Timer');
      expect(ids).toContain('Lives');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('should handle empty string gameType', () => {
      const chips = generateSuggestions([], '');
      expect(chips.length).toBeGreaterThan(0);
      expect(chips.length).toBeLessThanOrEqual(8);
    });

    it('should return only theme/style chips when all modules are present', () => {
      // Pass every module that exists in ALL_MODULE_SUGGESTIONS (31 modules)
      const allModules = [
        // Core
        'Timer', 'Lives', 'DifficultyRamp', 'ComboSystem', 'ParticleVFX',
        'SoundFX', 'CameraFollow', 'PowerUp',
        // Platformer
        'Jump', 'Dash', 'Collectible', 'Hazard', 'Checkpoint',
        'MovingPlatform', 'CrumblingPlatform', 'CoyoteTime',
        // Shooter/Combat
        'Health', 'Shield', 'IFrames', 'Knockback', 'BulletPattern',
        'Projectile', 'Aim', 'EnemyAI', 'WaveSpawner',
        // RPG/Progression
        'LevelUp', 'EnemyDrop', 'StatusEffect', 'SkillTree',
        'EquipmentSlot', 'DialogueSystem',
      ];
      const chips = generateSuggestions(allModules, 'catch');
      const ids = moduleIds(chips);
      // No module suggestions should remain
      expect(ids).toHaveLength(0);
      // But theme and style chips should still be present
      const themeChips = chips.filter((c) => c.id.startsWith('theme:'));
      const styleChips = chips.filter((c) => c.id.startsWith('style:'));
      expect(themeChips.length).toBeGreaterThanOrEqual(1);
      expect(styleChips.length).toBe(1);
    });

    it('should handle unknown modules in currentModules gracefully', () => {
      const chips = generateSuggestions(['NonExistentModule', 'AnotherFake'], 'catch');
      expect(chips.length).toBeGreaterThan(0);
      expect(chips.length).toBeLessThanOrEqual(8);
    });

    it('should have well-formed chip ids', () => {
      const chips = generateSuggestions([], 'catch');
      for (const chip of chips) {
        expect(chip.id).toMatch(/^(add|theme|style):/);
      }
    });
  });
});
