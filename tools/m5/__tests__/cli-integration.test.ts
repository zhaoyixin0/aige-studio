import { describe, it, expect } from 'vitest';
import { runPipeline, type PipelineResult } from '../cli.ts';
import { validateSequence } from '@/engine/systems/recipe-runner/validators.ts';
import {
  EXPERT_DATA_DIR,
  canRunOfflinePipelineTests,
} from '../../m0/__tests__/test-helpers';

describe.skipIf(!canRunOfflinePipelineTests())('M5 CLI pipeline integration', () => {
  let result: PipelineResult;

  // Run pipeline once for all tests
  it('pipeline classifies 80 files without crash', () => {
    result = runPipeline(EXPERT_DATA_DIR);

    expect(result.totalFiles).toBe(80);
    expect(result.classified.knowledge).toBeGreaterThan(30);
    expect(result.classified.sequence).toBeGreaterThan(10);
    expect(result.classified.utility).toBeGreaterThan(5);
    expect(result.classified.knowledge + result.classified.sequence + result.classified.utility).toBe(80);
  });

  it('generates presets for knowledge + sequence files (not utility)', () => {
    expect(result.presets.length).toBeGreaterThan(40);
    expect(result.presets.length).toBeLessThanOrEqual(70);
    // No utility files should produce presets
    expect(result.skippedUtility).toBeGreaterThan(5);
  });

  it('generates valid PresetTemplate for CardMatching_knowledge.json', () => {
    const cardMatching = result.presets.find((p) => p.id.includes('cardmatching'));
    expect(cardMatching).toBeDefined();
    expect(cardMatching!.gameType).toBe('puzzle');
    expect(cardMatching!.tags).toContain('expert-import');
    expect(cardMatching!.sequence.commands.length).toBeGreaterThan(0);
  });

  it('generates valid PresetTemplate for 2D_AngryBirds_Slingshot_Game.json', () => {
    const slingshot = result.presets.find((p) => p.id.includes('angrybirds'));
    expect(slingshot).toBeDefined();
    expect(slingshot!.gameType).toBe('slingshot');
    expect(slingshot!.params.length).toBeGreaterThan(0);
  });

  it('all generated presets pass validateSequence()', () => {
    for (const preset of result.presets) {
      const validation = validateSequence(preset.sequence);
      expect(validation.valid, `${preset.id} failed validation: ${JSON.stringify(validation.errors)}`).toBe(true);
    }
  });

  it('expert-index contains correct source→preset mapping', () => {
    expect(result.index.length).toBe(result.presets.length);

    for (const entry of result.index) {
      expect(entry.source).toBeTruthy();
      expect(entry.presetId).toMatch(/^expert-/);
      expect(entry.gameType).toBeTruthy();
      expect(typeof entry.confidence).toBe('number');
    }
  });

  it('confidence values are between 0 and 1', () => {
    for (const entry of result.index) {
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('draft presets have confidence < 0.6', () => {
    const drafts = result.presets.filter((p) => p.tags.includes('draft'));
    for (const draft of drafts) {
      const confTag = draft.tags.find((t) => t.startsWith('confidence:'));
      expect(confTag).toBeDefined();
      const conf = parseFloat(confTag!.split(':')[1]);
      expect(conf).toBeLessThan(0.6);
    }
  });
});
