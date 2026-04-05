import { describe, it, expect } from 'vitest';
import { ALL_GAME_TYPES, getGamePreset, GAME_TYPE_META } from '../game-presets';

describe('All game types have PRESETS', () => {
  it('every type in ALL_GAME_TYPES returns a preset', () => {
    const missing: string[] = [];
    for (const gt of ALL_GAME_TYPES) {
      if (!getGamePreset(gt)) missing.push(gt);
    }
    expect(missing, `Missing presets for: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('every preset includes GameFlow', () => {
    for (const gt of ALL_GAME_TYPES) {
      const preset = getGamePreset(gt);
      if (!preset) continue;
      expect(preset.GameFlow, `${gt} missing GameFlow`).toBeDefined();
    }
  });

  it('supported physics types include Gravity or Collision', () => {
    const physicsTypes = ['slingshot', 'ball-physics', 'trajectory', 'bouncing',
      'rope-cutting', 'ball-rolling', 'jelly'];
    for (const gt of physicsTypes) {
      const preset = getGamePreset(gt);
      expect(preset, `${gt} preset missing`).toBeDefined();
      const hasPhysics = preset!.Gravity || preset!.Collision;
      expect(hasPhysics, `${gt} should have Gravity or Collision`).toBeTruthy();
    }
  });

  it('sports/arcade types include Spawner or Collision', () => {
    const sportsTypes = ['racing', 'cross-road', 'maze', 'sugar-insert', 'swimmer'];
    for (const gt of sportsTypes) {
      const preset = getGamePreset(gt);
      expect(preset, `${gt} preset missing`).toBeDefined();
      const hasMechanic = preset!.Spawner || preset!.Collision || preset!.PlayerMovement;
      expect(hasMechanic, `${gt} should have Spawner/Collision/PlayerMovement`).toBeTruthy();
    }
  });

  it('unsupported types have minimal preset (GameFlow + Timer)', () => {
    const unsupported = ALL_GAME_TYPES.filter(
      (gt) => GAME_TYPE_META[gt]?.supportedToday === false,
    );
    for (const gt of unsupported) {
      const preset = getGamePreset(gt);
      expect(preset, `${gt} preset missing`).toBeDefined();
      expect(preset!.GameFlow, `${gt} missing GameFlow`).toBeDefined();
    }
  });
});
