import { describe, it, expect } from 'vitest';
import {
  PARAMETER_REGISTRY,
  getParamsForGameType,
  getParamsByLayer,
  getParamsByCategory,
  getParamById,
} from '../parameter-registry';

describe('ParameterRegistry', () => {
  describe('data integrity', () => {
    it('contains all 228 parameters', () => {
      expect(PARAMETER_REGISTRY.length).toBe(228);
    });

    it('has globally unique IDs', () => {
      const ids = PARAMETER_REGISTRY.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('every param has a non-empty id, name, and description', () => {
      for (const p of PARAMETER_REGISTRY) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.description).toBeTruthy();
      }
    });

    it('every param has a valid layer', () => {
      const validLayers = ['L1', 'L2', 'L3'];
      for (const p of PARAMETER_REGISTRY) {
        expect(validLayers).toContain(p.layer);
      }
    });

    it('every param has a valid mvp priority', () => {
      const validMvp = ['P0', 'P1', 'P2', 'P3'];
      for (const p of PARAMETER_REGISTRY) {
        expect(validMvp).toContain(p.mvp);
      }
    });

    it('every param has a valid exposure type', () => {
      const validExposure = ['direct', 'composite', 'hidden'];
      for (const p of PARAMETER_REGISTRY) {
        expect(validExposure).toContain(p.exposure);
      }
    });

    it('every param has a valid controlType', () => {
      const validControls = [
        'toggle',
        'slider',
        'segmented',
        'stepper',
        'asset_picker',
        'input_field',
      ];
      for (const p of PARAMETER_REGISTRY) {
        expect(validControls).toContain(p.controlType);
      }
    });

    it('every param has a defaultValue defined', () => {
      for (const p of PARAMETER_REGISTRY) {
        expect(p.defaultValue).toBeDefined();
      }
    });

    it('every param has non-empty gameTypes array', () => {
      for (const p of PARAMETER_REGISTRY) {
        expect(p.gameTypes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('layer distribution', () => {
    it('has 3 L1 params', () => {
      expect(getParamsByLayer('L1').length).toBe(3);
    });

    it('has 15 L2 params', () => {
      expect(getParamsByLayer('L2').length).toBe(15);
    });

    it('has 210 L3 params', () => {
      expect(getParamsByLayer('L3').length).toBe(210);
    });
  });

  describe('query APIs', () => {
    it('getParamById returns correct param', () => {
      const first = PARAMETER_REGISTRY[0];
      const result = getParamById(first.id);
      expect(result).toBe(first);
    });

    it('getParamById returns undefined for non-existent ID', () => {
      expect(getParamById('non_existent_id_xyz')).toBeUndefined();
    });

    it('getParamsForGameType("ALL") returns params applicable to all games', () => {
      const allParams = getParamsForGameType('ALL');
      expect(allParams.length).toBeGreaterThan(0);
      for (const p of allParams) {
        expect(p.gameTypes).toContain('ALL');
      }
    });

    it('getParamsForGameType filters by specific game type', () => {
      const shooterParams = getParamsForGameType('shooting');
      expect(shooterParams.length).toBeGreaterThan(0);
      for (const p of shooterParams) {
        expect(
          p.gameTypes.includes('ALL') || p.gameTypes.includes('shooting')
        ).toBe(true);
      }
    });

    it('getParamsByCategory returns params for a valid category', () => {
      const mechanics = getParamsByCategory('game_mechanics');
      expect(mechanics.length).toBeGreaterThan(0);
      for (const p of mechanics) {
        expect(p.category).toBe('game_mechanics');
      }
    });

    it('getParamsByCategory returns empty array for unknown category', () => {
      expect(getParamsByCategory('nonexistent' as any).length).toBe(0);
    });

    it('getParamsByLayer returns empty array for invalid layer', () => {
      expect(getParamsByLayer('L4' as any).length).toBe(0);
    });
  });

  describe('MVP distribution', () => {
    it('has 12 P0 params', () => {
      const p0 = PARAMETER_REGISTRY.filter((p) => p.mvp === 'P0');
      expect(p0.length).toBe(12);
    });

    it('has 25 P1 params', () => {
      const p1 = PARAMETER_REGISTRY.filter((p) => p.mvp === 'P1');
      expect(p1.length).toBe(25);
    });
  });

  describe('dependency references', () => {
    it('all dependsOn.paramId references point to existing params', () => {
      const allIds = new Set(PARAMETER_REGISTRY.map((p) => p.id));
      for (const p of PARAMETER_REGISTRY) {
        if (p.dependsOn) {
          expect(allIds.has(p.dependsOn.paramId)).toBe(true);
        }
      }
    });
  });
});
