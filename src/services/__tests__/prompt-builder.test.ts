// src/services/__tests__/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../prompt-builder.ts';

describe('PromptBuilder', () => {
  it('should build prompt for a good item in fruit theme', () => {
    const prompt = PromptBuilder.build('star', {
      gameType: 'catch',
      theme: 'fruit',
      role: 'good',
      style: 'cartoon',
    });
    expect(prompt).toContain('star');
    expect(prompt).toContain('cartoon');
    expect(prompt).toContain('collectible');
  });

  it('should build prompt for a bad item', () => {
    const prompt = PromptBuilder.build('bomb', {
      gameType: 'dodge',
      theme: 'space',
      role: 'bad',
      style: 'cartoon',
    });
    expect(prompt).toContain('bomb');
    expect(prompt).toContain('dangerous');
  });

  it('should build prompt for player character', () => {
    const prompt = PromptBuilder.build('player', {
      gameType: 'catch',
      theme: 'ocean',
      role: 'player',
      style: 'cartoon',
    });
    expect(prompt).toContain('character');
  });

  it('should build prompt for background', () => {
    const prompt = PromptBuilder.build('sky', {
      gameType: 'catch',
      theme: 'space',
      role: 'background',
      style: 'cartoon',
    });
    expect(prompt).toContain('background');
    expect(prompt).toContain('1080x1920');
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
    // Should not crash even with unknown theme
    expect(prompt.length).toBeGreaterThan(0);
  });
});
