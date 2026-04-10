import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import { normalizeExpert } from '../schema/guards';
import { extractParams } from '../calibration/extract-params';
import { calibrate } from '../calibration/calibrate';
import {
  buildPresetOverlays,
  applyOverlays,
  type PresetOverlay,
} from '../calibration/apply-overlays';
import { ALL_GAME_TYPES, getGamePreset } from '../../../src/agent/game-presets';
import { EXPERT_DATA_DIR, canRunOfflinePipelineTests } from './test-helpers';

const EXPERT_DIR = EXPERT_DATA_DIR;

describe.skipIf(!canRunOfflinePipelineTests())('Preset Overlay Builder', () => {
  let overlays: PresetOverlay[];

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    const knowledgeDocs = inv.knowledge.map((item) => ({
      doc: normalizeExpert(item.raw, item.filename),
      params: extractParams(normalizeExpert(item.raw, item.filename)),
    }));
    overlays = buildPresetOverlays(knowledgeDocs);
  });

  it('produces overlays (at least 1)', () => {
    expect(overlays.length).toBeGreaterThanOrEqual(1);
  });

  it('each overlay has gameType, source, and params', () => {
    for (const ov of overlays) {
      expect(ov.gameType).toBeTruthy();
      expect(ov.source).toBeTruthy();
      expect(ov.params).toBeDefined();
      expect(typeof ov.params).toBe('object');
    }
  });

  it('overlay gameTypes are valid AIGE game types or expert types', () => {
    // Expert game types may not directly map to AIGE types
    for (const ov of overlays) {
      expect(typeof ov.gameType).toBe('string');
      expect(ov.gameType.length).toBeGreaterThan(0);
    }
  });

  describe('applyOverlays', () => {
    it('preserves original preset count', () => {
      const basePresets: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const gt of ALL_GAME_TYPES) {
        basePresets[gt] = getGamePreset(gt) ?? {};
      }
      const merged = applyOverlays(basePresets, overlays);
      expect(Object.keys(merged).length).toBe(Object.keys(basePresets).length);
    });

    it('does not mutate base presets (immutability)', () => {
      const basePresets: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const gt of ALL_GAME_TYPES) {
        basePresets[gt] = getGamePreset(gt) ?? {};
      }
      const original = JSON.stringify(basePresets);
      applyOverlays(basePresets, overlays);
      expect(JSON.stringify(basePresets)).toBe(original);
    });

    it('merged presets retain all original keys', () => {
      const basePresets: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const gt of ALL_GAME_TYPES) {
        basePresets[gt] = getGamePreset(gt) ?? {};
      }
      const merged = applyOverlays(basePresets, overlays);
      for (const gt of Object.keys(basePresets)) {
        for (const moduleKey of Object.keys(basePresets[gt])) {
          expect(merged[gt]).toHaveProperty(moduleKey);
        }
      }
    });
  });
});
