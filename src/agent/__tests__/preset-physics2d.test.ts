import { describe, it, expect } from 'vitest';
import { getGamePreset } from '../game-presets';

describe('Physics2D Preset Integration', () => {
  const physicsGameTypes = ['slingshot', 'bouncing'];

  for (const gameType of physicsGameTypes) {
    describe(gameType, () => {
      it('includes Physics2D module', () => {
        const preset = getGamePreset(gameType);
        expect(preset).toBeDefined();
        expect(preset!.Physics2D).toBeDefined();
      });

      it('has valid gravity config', () => {
        const preset = getGamePreset(gameType)!;
        const phys = preset.Physics2D as Record<string, unknown>;
        expect(typeof phys.gravityY).toBe('number');
        expect(typeof phys.pixelsPerMeter).toBe('number');
      });

      it('includes Tween module with clips', () => {
        const preset = getGamePreset(gameType)!;
        expect(preset.Tween).toBeDefined();
        const tween = preset.Tween as Record<string, unknown>;
        expect(Array.isArray(tween.clips)).toBe(true);
      });
    });
  }
});
