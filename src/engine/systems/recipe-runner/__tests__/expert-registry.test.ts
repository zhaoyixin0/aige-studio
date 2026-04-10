import { describe, it, expect, beforeEach } from 'vitest';
import { createExpertRegistry, EXPERT_PRESETS } from '../index.ts';
import { resolvePreset, _resetRegistry } from '../facade.ts';

describe('Expert Registry', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it('createExpertRegistry loads expert presets', () => {
    const registry = createExpertRegistry();
    expect(registry.size()).toBe(EXPERT_PRESETS.length);
  });

  it('EXPERT_PRESETS are tagged with expert-import', () => {
    for (const preset of EXPERT_PRESETS) {
      expect(preset.tags).toContain('expert-import');
    }
  });

  it('resolvePreset returns null for hero-skeleton presetIds', () => {
    // All hero presets are now hero-skeleton v2 and are routed through
    // HERO_SKELETON_PRESETS inside runPresetToConfig, so resolvePreset()
    // (which only returns legacy PresetTemplate entries) returns null
    // for every hero id.
    const result = resolvePreset({ presetId: 'hero-platformer-basic' });
    expect(result).toBeNull();
  });

  it('resolvePreset falls back to expert preset by ID', () => {
    // Expert presets use expert- prefix IDs
    if (EXPERT_PRESETS.length === 0) return; // Skip if no expert presets loaded
    const firstExpert = EXPERT_PRESETS[0];
    const result = resolvePreset({ presetId: firstExpert.id });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(firstExpert.id);
    expect(result!.tags).toContain('expert-import');
  });

  it('resolvePreset falls back to expert preset by gameType', () => {
    if (EXPERT_PRESETS.length === 0) return;
    // Find an expert preset with a gameType that has no hero preset
    const expertOnly = EXPERT_PRESETS.find((p) =>
      p.gameType && !['catch', 'shooting', 'platformer'].includes(p.gameType),
    );
    if (!expertOnly) return;
    const result = resolvePreset({ gameType: expertOnly.gameType! });
    expect(result).not.toBeNull();
    // Should be an expert preset
    expect(result!.tags).toContain('expert-import');
  });
});
