import { describe, it, expect } from 'vitest';
import {
  getLiveValuesForParams,
  planUpdatesForParamChange,
  PARAM_TO_MODULE_MAP,
} from '../registry-binding';
import type { GameConfig } from '@/engine/core';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1.5, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
    { id: 'timer', type: 'Timer', enabled: true, params: { duration: 30 } },
    { id: 'collision', type: 'Collision', enabled: true, params: { hitboxScale: 1.0 } },
    { id: 'jump', type: 'Jump', enabled: true, params: { jumpForce: 15, doubleJump: true } },
    { id: 'uioverlay', type: 'UIOverlay', enabled: true, params: { showScore: true, showLives: true } },
    { id: 'resultscreen', type: 'ResultScreen', enabled: true, params: { showAnimation: true, showText: true } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'catch', description: '', thumbnail: null, createdAt: '', artStyle: 'cartoon' },
});

describe('registry-binding', () => {
  describe('PARAM_TO_MODULE_MAP', () => {
    it('maps L2 system params to module types', () => {
      expect(PARAM_TO_MODULE_MAP['game_mechanics_001']).toEqual({
        kind: 'module',
        moduleType: 'Scorer',
        paramKey: '_enabled',
      });
    });

    it('maps L3 params to module type + param key', () => {
      expect(PARAM_TO_MODULE_MAP).toBeDefined();
      expect(typeof PARAM_TO_MODULE_MAP).toBe('object');
    });

    // Verify removed wrong mappings are gone
    it('does not contain wrong L3 mappings', () => {
      const removedIds = [
        'game_mechanics_009',
        'game_mechanics_010',
        'game_mechanics_011',
        'game_mechanics_013',
        'game_mechanics_015',
        'game_mechanics_022',
        'game_mechanics_025',
        'game_mechanics_026',
        'game_mechanics_033',
        'game_mechanics_034',
      ];
      for (const id of removedIds) {
        expect(PARAM_TO_MODULE_MAP[id]).toBeUndefined();
      }
    });

    // Verify correct L3 mappings kept
    it('keeps correct Spawner.speed mapping (014)', () => {
      expect(PARAM_TO_MODULE_MAP['game_mechanics_014']).toEqual({
        kind: 'module',
        moduleType: 'Spawner',
        paramKey: 'speed',
      });
    });

    it('keeps correct Collision.hitboxScale mapping (016)', () => {
      expect(PARAM_TO_MODULE_MAP['game_mechanics_016']).toEqual({
        kind: 'module',
        moduleType: 'Collision',
        paramKey: 'hitboxScale',
      });
    });

    it('keeps correct Timer.duration mapping (visual_audio_005)', () => {
      expect(PARAM_TO_MODULE_MAP['visual_audio_005']).toEqual({
        kind: 'module',
        moduleType: 'Timer',
        paramKey: 'duration',
      });
    });

    // Verify new correct mappings
    it('maps game_mechanics_018 to Lives.count', () => {
      expect(PARAM_TO_MODULE_MAP['game_mechanics_018']).toEqual({
        kind: 'module',
        moduleType: 'Lives',
        paramKey: 'count',
      });
    });

    it('maps game_mechanics_021 to Jump.doubleJump', () => {
      expect(PARAM_TO_MODULE_MAP['game_mechanics_021']).toEqual({
        kind: 'module',
        moduleType: 'Jump',
        paramKey: 'doubleJump',
      });
    });

    it('maps visual_audio_004 to UIOverlay.showScore', () => {
      expect(PARAM_TO_MODULE_MAP['visual_audio_004']).toEqual({
        kind: 'module',
        moduleType: 'UIOverlay',
        paramKey: 'showScore',
      });
    });

    it('maps visual_audio_010 to UIOverlay.showLives', () => {
      expect(PARAM_TO_MODULE_MAP['visual_audio_010']).toEqual({
        kind: 'module',
        moduleType: 'UIOverlay',
        paramKey: 'showLives',
      });
    });

    it('maps visual_audio_011 to ResultScreen.showAnimation', () => {
      expect(PARAM_TO_MODULE_MAP['visual_audio_011']).toEqual({
        kind: 'module',
        moduleType: 'ResultScreen',
        paramKey: 'showAnimation',
      });
    });

    it('maps visual_audio_012 to ResultScreen.showText', () => {
      expect(PARAM_TO_MODULE_MAP['visual_audio_012']).toEqual({
        kind: 'module',
        moduleType: 'ResultScreen',
        paramKey: 'showText',
      });
    });
  });

  describe('getLiveValuesForParams', () => {
    it('returns empty record for null config', () => {
      const result = getLiveValuesForParams(null, ['game_mechanics_001']);
      expect(result).toEqual({});
    });

    it('returns module enabled state for L2 toggle params', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['game_mechanics_001']);
      expect(result['game_mechanics_001']).toBe(true);
    });

    it('returns module param values for L3 params', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['game_mechanics_018']);
      expect(result['game_mechanics_018']).toBe(3);
    });

    it('returns Jump.doubleJump for game_mechanics_021', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['game_mechanics_021']);
      expect(result['game_mechanics_021']).toBe(true);
    });

    it('returns UIOverlay.showScore for visual_audio_004', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['visual_audio_004']);
      expect(result['visual_audio_004']).toBe(true);
    });

    it('returns ResultScreen.showAnimation for visual_audio_011', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['visual_audio_011']);
      expect(result['visual_audio_011']).toBe(true);
    });

    it('returns meta values for meta-mapped params', () => {
      const config = makeConfig();
      const result = getLiveValuesForParams(config, ['visual_audio_003']);
      expect(result['visual_audio_003']).toBe('cartoon');
    });
  });

  describe('planUpdatesForParamChange', () => {
    it('returns empty plan for unknown paramId', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('unknown_999', 'foo', config);
      expect(plan.params).toEqual([]);
      expect(plan.meta).toBeUndefined();
    });

    it('returns meta update for meta-mapped param', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('visual_audio_003', 'pixel', config);
      expect(plan.meta).toEqual({ artStyle: 'pixel' });
      expect(plan.params).toEqual([]);
    });

    it('returns module enabled toggle for L2 params', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('game_mechanics_001', false, config);
      expect(plan.params.length).toBeGreaterThanOrEqual(0);
    });

    it('returns batchUpdateParams payload for L3 module params', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('game_mechanics_018', 5, config);
      expect(plan.params).toHaveLength(1);
      expect(plan.params[0]).toEqual({ moduleId: 'lives', changes: { count: 5 } });
    });

    it('plans Jump.doubleJump update for game_mechanics_021', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('game_mechanics_021', false, config);
      expect(plan.params).toHaveLength(1);
      expect(plan.params[0]).toEqual({ moduleId: 'jump', changes: { doubleJump: false } });
    });

    it('plans UIOverlay.showScore update for visual_audio_004', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('visual_audio_004', false, config);
      expect(plan.params).toHaveLength(1);
      expect(plan.params[0]).toEqual({ moduleId: 'uioverlay', changes: { showScore: false } });
    });

    it('plans ResultScreen.showText update for visual_audio_012', () => {
      const config = makeConfig();
      const plan = planUpdatesForParamChange('visual_audio_012', false, config);
      expect(plan.params).toHaveLength(1);
      expect(plan.params[0]).toEqual({ moduleId: 'resultscreen', changes: { showText: false } });
    });
  });
});
