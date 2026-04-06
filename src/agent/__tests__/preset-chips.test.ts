import { describe, it, expect } from 'vitest';
import { DEFAULT_CHIPS, getPresetIdFromChip } from '@/store/editor-store';
import { SYSTEM_PROMPT_BASE, HERO_PRESET_IDS } from '../conversation-defs';

describe('preset chips in DEFAULT_CHIPS', () => {
  const presetChips = DEFAULT_CHIPS.filter((c) => c.type === 'preset');

  it('DEFAULT_CHIPS includes preset-type chips', () => {
    expect(presetChips.length).toBeGreaterThanOrEqual(3);
  });

  it('all preset chip IDs have "preset:" prefix', () => {
    for (const chip of presetChips) {
      expect(chip.id).toMatch(/^preset:hero-/);
    }
  });

  it('preset chip IDs reference valid hero preset IDs', () => {
    for (const chip of presetChips) {
      const presetId = getPresetIdFromChip(chip);
      expect(presetId).not.toBeNull();
      expect(HERO_PRESET_IDS as readonly string[]).toContain(presetId);
    }
  });

  it('all preset chips have emoji', () => {
    for (const chip of presetChips) {
      expect(chip.emoji).toBeDefined();
      expect(chip.emoji).not.toBe('');
    }
  });
});

describe('system prompt includes preset info', () => {
  it('system prompt mentions use_preset', () => {
    expect(SYSTEM_PROMPT_BASE).toContain('use_preset');
  });

  it('system prompt lists hero presets', () => {
    expect(SYSTEM_PROMPT_BASE).toContain('hero-catch-fruit');
    expect(SYSTEM_PROMPT_BASE).toContain('hero-shooter-wave');
    expect(SYSTEM_PROMPT_BASE).toContain('hero-platformer-basic');
  });
});
