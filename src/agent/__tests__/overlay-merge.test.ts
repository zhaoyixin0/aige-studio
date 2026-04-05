import { describe, it, expect } from 'vitest';
import type { GamePreset } from '../game-presets';
import { mergePresetWithOverlay } from '../preset-overlays';

describe('mergePresetWithOverlay', () => {
  const basePreset: GamePreset = {
    Spawner: { interval: 1000, maxItems: 5 },
    Timer: { duration: 30 },
  };

  it('returns base unchanged when no overlay exists', () => {
    const result = mergePresetWithOverlay(basePreset, 'nonexistent-type');
    expect(result).toEqual(basePreset);
  });

  it('does not mutate the original preset', () => {
    const frozen = structuredClone(basePreset);
    mergePresetWithOverlay(basePreset, 'shooting');
    expect(basePreset).toEqual(frozen);
  });

  it('returns a GamePreset object (not undefined)', () => {
    const result = mergePresetWithOverlay(basePreset, 'shooting');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('preserves existing params when overlay confidence < 0.6', () => {
    // Current overlay data has all confidences < 0.6, so nothing should change
    const result = mergePresetWithOverlay(basePreset, 'shooting');
    expect(result.Spawner).toEqual(basePreset.Spawner);
    expect(result.Timer).toEqual(basePreset.Timer);
  });
});
