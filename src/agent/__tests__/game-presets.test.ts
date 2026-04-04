import { describe, it, expect } from 'vitest';
import { getGamePreset, getModuleParams, ALL_GAME_TYPES } from '../game-presets';

describe('GamePresets', () => {
  it('should have presets for all 8 game types', () => {
    const types = ['catch', 'dodge', 'quiz', 'random-wheel', 'tap', 'shooting', 'expression', 'runner'];
    for (const type of types) {
      expect(getGamePreset(type)).toBeDefined();
    }
  });

  // Only iterate types that have a full preset definition (not stub-only types)
  const typesWithPresets = ALL_GAME_TYPES.filter((t) => getGamePreset(t) !== undefined);

  it('each preset should have valid module params', () => {
    for (const type of typesWithPresets) {
      const preset = getGamePreset(type);
      // Every preset must include at least GameFlow
      expect(preset!.GameFlow).toBeDefined();
    }
  });

  it('Spawner presets should always have items array', () => {
    for (const type of typesWithPresets) {
      const preset = getGamePreset(type)!;
      if (preset.Spawner) {
        const spawner = preset.Spawner as Record<string, any>;
        expect(Array.isArray(spawner.items)).toBe(true);
        expect(spawner.items.length).toBeGreaterThan(0);
        expect(spawner.speed).toBeDefined();
        expect(spawner.frequency).toBeGreaterThan(0);
      }
    }
  });

  it('Collision presets should always have rules array', () => {
    for (const type of typesWithPresets) {
      const preset = getGamePreset(type)!;
      if (preset.Collision) {
        const collision = preset.Collision as Record<string, any>;
        expect(Array.isArray(collision.rules)).toBe(true);
      }
    }
  });

  it('DifficultyRamp presets should have target and rules', () => {
    for (const type of typesWithPresets) {
      const preset = getGamePreset(type)!;
      if (preset.DifficultyRamp) {
        const ramp = preset.DifficultyRamp as Record<string, any>;
        expect(ramp.target).toBeDefined();
        expect(Array.isArray(ramp.rules)).toBe(true);
      }
    }
  });

  it('Timer duration should match common social game durations', () => {
    for (const type of typesWithPresets) {
      const preset = getGamePreset(type)!;
      if (preset.Timer) {
        const timer = preset.Timer as Record<string, any>;
        expect([15, 30, 60, 90, 120]).toContain(timer.duration);
      }
    }
  });

  it('should return fallback defaults for AudioInput', () => {
    const params = getModuleParams('catch', 'AudioInput');
    expect(params).toEqual({ threshold: 0.5 });
  });

  it('should return fallback defaults for DeviceInput', () => {
    const params = getModuleParams('catch', 'DeviceInput');
    expect(params).toEqual({ sensitivity: 1.0 });
  });

  it('should return preset-specific params over fallbacks when available', () => {
    // catch has FaceInput with smoothing: 0.3, sensitivity: 1.0
    const params = getModuleParams('catch', 'FaceInput');
    expect(params).toEqual({ smoothing: 0.3, sensitivity: 1.0 });
  });

  it('should return fallback for input modules on game types without that input', () => {
    // expression does not have HandInput preset, so fallback should apply
    const params = getModuleParams('expression', 'HandInput');
    expect(params).toEqual({ smoothing: 0.3 });
  });

  it('should return empty object for unknown module types', () => {
    const params = getModuleParams('catch', 'UnknownModule');
    expect(params).toEqual({});
  });

  it('should return empty object for unknown game types', () => {
    const params = getModuleParams('nonexistent', 'GameFlow');
    expect(params).toEqual({});
  });
});
