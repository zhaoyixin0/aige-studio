import { describe, it, expect } from 'vitest';
import { getGamePreset } from '../game-presets';

describe('ScrollingLayers Preset Integration', () => {
  const scrollingGameTypes = ['runner', 'racing', 'swimmer'];

  for (const gameType of scrollingGameTypes) {
    describe(gameType, () => {
      it('includes ScrollingLayers module', () => {
        const preset = getGamePreset(gameType);
        expect(preset).toBeDefined();
        expect(preset!.ScrollingLayers).toBeDefined();
      });

      it('has valid layers config with ratios', () => {
        const preset = getGamePreset(gameType)!;
        const sl = preset.ScrollingLayers as Record<string, unknown>;
        expect(sl.axis).toBeDefined();
        expect(typeof sl.baseSpeed).toBe('number');
        const layers = sl.layers as Array<{ textureId: string; ratio: number }>;
        expect(layers.length).toBeGreaterThanOrEqual(2);
        for (const layer of layers) {
          expect(typeof layer.textureId).toBe('string');
          expect(layer.ratio).toBeGreaterThan(0);
          expect(layer.ratio).toBeLessThanOrEqual(1);
        }
      });
    });
  }

  it('runner uses horizontal axis', () => {
    const preset = getGamePreset('runner')!;
    expect((preset.ScrollingLayers as any).axis).toBe('horizontal');
  });

  it('swimmer uses vertical axis', () => {
    const preset = getGamePreset('swimmer')!;
    expect((preset.ScrollingLayers as any).axis).toBe('vertical');
  });
});
