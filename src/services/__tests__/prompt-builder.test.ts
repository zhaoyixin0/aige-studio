// src/services/__tests__/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../prompt-builder.ts';

describe('PromptBuilder', () => {
  it('should build sprite prompt with green background requirement', () => {
    const prompt = PromptBuilder.build('good_1', {
      gameType: 'catch',
      theme: 'fruit',
      role: 'good',
      style: 'cartoon',
    });
    expect(prompt).toContain('strawberry');
    expect(prompt).toContain('cartoon');
    expect(prompt).toContain('#00FF00');
    expect(prompt).toContain('sharp edges');
  });

  it('should build prompt for a bad item with danger hint', () => {
    const prompt = PromptBuilder.build('bad_1', {
      gameType: 'dodge',
      theme: 'space',
      role: 'bad',
      style: 'cartoon',
    });
    expect(prompt).toContain('asteroid');
    expect(prompt).toContain('DANGEROUS');
    expect(prompt).toContain('#00FF00');
  });

  it('should build player prompt with character template', () => {
    const prompt = PromptBuilder.build('player', {
      gameType: 'catch',
      theme: 'ocean',
      role: 'player',
      style: 'cartoon',
    });
    expect(prompt).toContain('character');
    expect(prompt).toContain('tropical fish');
    expect(prompt).toContain('#00FF00');
  });

  it('should build background prompt without green screen', () => {
    const prompt = PromptBuilder.build('background', {
      gameType: 'catch',
      theme: 'space',
      role: 'background',
      style: 'cartoon',
    });
    expect(prompt).toContain('background');
    expect(prompt).toContain('9:16');
    expect(prompt).not.toContain('#00FF00');
  });

  it('should infer role for known bad keys', () => {
    expect(PromptBuilder.inferRole('bomb')).toBe('bad');
    expect(PromptBuilder.inferRole('meteor')).toBe('bad');
    expect(PromptBuilder.inferRole('ghost')).toBe('bad');
    expect(PromptBuilder.inferRole('obstacle')).toBe('bad');
  });

  it('should infer role for player keys', () => {
    expect(PromptBuilder.inferRole('player')).toBe('player');
    expect(PromptBuilder.inferRole('character')).toBe('player');
  });

  it('should infer role for background keys', () => {
    expect(PromptBuilder.inferRole('sky')).toBe('background');
    expect(PromptBuilder.inferRole('space_bg')).toBe('background');
    expect(PromptBuilder.inferRole('background')).toBe('background');
  });

  it('should infer role for bullet keys', () => {
    expect(PromptBuilder.inferRole('bullet')).toBe('bullet');
    expect(PromptBuilder.inferRole('projectile')).toBe('bullet');
  });

  it('should default to good role for unknown keys', () => {
    expect(PromptBuilder.inferRole('star')).toBe('good');
    expect(PromptBuilder.inferRole('coin')).toBe('good');
    expect(PromptBuilder.inferRole('apple')).toBe('good');
  });

  it('should use fallback for unknown asset key', () => {
    const prompt = PromptBuilder.build('custom_item', {
      gameType: 'catch',
      theme: 'fruit',
      role: 'good',
      style: 'cartoon',
    });
    expect(prompt).toContain('custom_item');
  });

  it('should use fallback for unknown theme', () => {
    const prompt = PromptBuilder.build('star', {
      gameType: 'catch',
      theme: 'unknown_theme',
      role: 'good',
      style: 'cartoon',
    });
    expect(prompt).toContain('star');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should support all art styles', () => {
    for (const style of ['cartoon', 'pixel', 'flat', 'realistic', 'watercolor', 'chibi']) {
      const prompt = PromptBuilder.build('star', {
        gameType: 'catch', theme: 'fruit', role: 'good', style,
      });
      expect(prompt.length).toBeGreaterThan(50);
    }
  });

  // ── Enemy role ────────────────────────────────────────────────

  it('should build enemy prompt with menacing hints', () => {
    const prompt = PromptBuilder.build('enemy_1', {
      gameType: 'shooting', theme: 'space', role: 'enemy', style: 'cartoon',
    });
    expect(prompt).toContain('enemy');
    expect(prompt).toContain('menacing');
    expect(prompt).toContain('#00FF00');
    expect(prompt).toContain('hostile');
  });

  it('should infer enemy role from enemy_ prefix', () => {
    expect(PromptBuilder.inferRole('enemy_1')).toBe('enemy');
    expect(PromptBuilder.inferRole('boss_dragon')).toBe('enemy');
    expect(PromptBuilder.inferRole('zombie')).toBe('enemy');
    expect(PromptBuilder.inferRole('skeleton_warrior')).toBe('enemy');
  });

  // ── NPC role ──────────────────────────────────────────────────

  it('should build npc prompt with portrait composition', () => {
    const prompt = PromptBuilder.build('npc_elder', {
      gameType: 'action-rpg', theme: 'halloween', role: 'npc', style: 'cartoon',
    });
    expect(prompt).toContain('portrait');
    expect(prompt).toContain('NPC');
    expect(prompt).toContain('#00FF00');
    expect(prompt).toContain('dialogue');
  });

  it('should infer npc role from npc_ prefix', () => {
    expect(PromptBuilder.inferRole('npc_elder')).toBe('npc');
    expect(PromptBuilder.inferRole('npc_merchant')).toBe('npc');
    expect(PromptBuilder.inferRole('portrait_hero')).toBe('npc');
  });

  // ── Drop role ─────────────────────────────────────────────────

  it('should build drop prompt with loot hints', () => {
    const prompt = PromptBuilder.build('drop_health', {
      gameType: 'action-rpg', theme: 'fruit', role: 'drop', style: 'cartoon',
    });
    expect(prompt).toContain('loot');
    expect(prompt).toContain('sparkle');
    expect(prompt).toContain('#00FF00');
  });

  it('should infer drop role from drop_ prefix', () => {
    expect(PromptBuilder.inferRole('drop_gold')).toBe('drop');
    expect(PromptBuilder.inferRole('loot_box')).toBe('drop');
    expect(PromptBuilder.inferRole('potion')).toBe('drop');
  });
});
