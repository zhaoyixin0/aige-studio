import { describe, it, expect } from 'vitest';
import { synthesize } from '../synthesizer.ts';
import type { ExpertIR } from '../types.ts';
import type { PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';

function makeIR(overrides: Partial<ExpertIR> = {}): ExpertIR {
  return {
    id: 'expert-test',
    title: 'Test Expert',
    description: 'A test expert preset',
    gameTypeHint: 'TestGame',
    aigeGameType: 'catch',
    tags: ['expert-import', 'knowledge'],
    params: [
      { name: 'duration', type: 'number' },
      { name: 'speed', type: 'number' },
    ],
    assets: [
      { id: 'asset-0', type: 'image', src: 'bg.png' },
    ],
    moduleHints: [
      { type: 'Tween', params: { duration: 500 } },
    ],
    unmappedComponents: [],
    sourcePath: 'test.json',
    confidence: 0,
    ...overrides,
  };
}

describe('synthesize', () => {
  it('produces valid PresetTemplate shape', () => {
    const ir = makeIR();
    const preset = synthesize(ir);

    expect(preset.id).toBe('expert-test');
    expect(preset.title).toBe('Test Expert');
    expect(preset.description).toContain('A test expert preset');
    expect(preset.gameType).toBe('catch');
    expect(preset.tags).toContain('expert-import');
    expect(preset.sequence).toBeDefined();
    expect(preset.sequence.id).toBe('expert-test');
    expect(Array.isArray(preset.sequence.commands)).toBe(true);
  });

  it('includes setMeta command with source info', () => {
    const ir = makeIR();
    const preset = synthesize(ir);

    const metaCmd = preset.sequence.commands.find((c) => c.name === 'setMeta');
    expect(metaCmd).toBeDefined();
    expect(metaCmd!.args.sourcePath).toBe('test.json');
  });

  it('includes configureCanvas command', () => {
    const ir = makeIR();
    const preset = synthesize(ir);

    const canvasCmd = preset.sequence.commands.find((c) => c.name === 'configureCanvas');
    expect(canvasCmd).toBeDefined();
    expect(canvasCmd!.args.width).toBe(1080);
    expect(canvasCmd!.args.height).toBe(1920);
  });

  it('includes addAsset commands for each asset', () => {
    const ir = makeIR({
      assets: [
        { id: 'asset-0', type: 'image', src: 'bg.png' },
        { id: 'asset-1', type: 'image', src: 'player.png' },
      ],
    });
    const preset = synthesize(ir);

    const assetCmds = preset.sequence.commands.filter((c) => c.name === 'addAsset');
    expect(assetCmds.length).toBe(2);
  });

  it('maps IR params to PresetTemplate params', () => {
    const ir = makeIR({
      params: [
        { name: 'duration', type: 'number', description: 'Game time' },
        { name: 'texture', type: 'assetId' },
      ],
    });
    const preset = synthesize(ir);

    expect(preset.params.length).toBe(2);
    expect(preset.params[0].name).toBe('duration');
    expect(preset.params[0].type).toBe('number');
    expect(preset.params[1].name).toBe('texture');
    expect(preset.params[1].type).toBe('assetId');
  });

  it('adds base modules from game type', () => {
    const ir = makeIR({ aigeGameType: 'catch' });
    const preset = synthesize(ir);

    const addModuleCmds = preset.sequence.commands.filter((c) => c.name === 'addModule');
    // Should have at minimum GameFlow for catch type
    const moduleTypes = addModuleCmds.map((c) => c.args.type);
    expect(moduleTypes).toContain('GameFlow');
  });

  it('adds extra modules from moduleHints', () => {
    const ir = makeIR({
      moduleHints: [
        { type: 'Tween', params: { duration: 500 } },
        { type: 'Physics2D', params: { gravity: 9.8 } },
      ],
    });
    const preset = synthesize(ir);

    const addModuleCmds = preset.sequence.commands.filter((c) => c.name === 'addModule');
    const moduleTypes = addModuleCmds.map((c) => c.args.type);
    expect(moduleTypes).toContain('Tween');
    expect(moduleTypes).toContain('Physics2D');
  });

  it('computes confidence score correctly', () => {
    // All signals present: gameType mapped, asset found, 3+ modules, no unmapped
    const highConfidence = synthesize(makeIR({
      aigeGameType: 'catch', // mapped (not fallback)
      assets: [{ id: 'a', type: 'image', src: 'x.png' }],
      moduleHints: [
        { type: 'Tween', params: {} },
        { type: 'Physics2D', params: {} },
        { type: 'ScrollingLayers', params: {} },
      ],
      unmappedComponents: [],
    }));
    expect(highConfidence.tags).toContain('expert-import');
    // confidence is encoded in description or as tag
    // With all signals: 0.25 + 0.15 + 0.35 + 0.25 = 1.0
    const confTag = highConfidence.tags.find((t) => t.startsWith('confidence:'));
    expect(confTag).toBeDefined();
    expect(parseFloat(confTag!.split(':')[1])).toBeGreaterThanOrEqual(0.75);

    // Low confidence: fallback gameType, no assets, no modules, many unmapped
    const lowConfidence = synthesize(makeIR({
      aigeGameType: 'tap', // fallback
      gameTypeHint: null,
      assets: [],
      moduleHints: [],
      unmappedComponents: ['CustomPlugin1', 'CustomPlugin2'],
    }));
    const lowTag = lowConfidence.tags.find((t) => t.startsWith('confidence:'));
    expect(lowTag).toBeDefined();
    expect(parseFloat(lowTag!.split(':')[1])).toBeLessThan(0.75);
  });

  it('marks low-confidence presets as draft', () => {
    const preset = synthesize(makeIR({
      aigeGameType: 'tap',
      gameTypeHint: null,
      assets: [],
      moduleHints: [],
      unmappedComponents: ['A', 'B'],
    }));
    expect(preset.tags).toContain('draft');
  });

  it('sets requiredModules from addModule commands', () => {
    const ir = makeIR({ aigeGameType: 'catch' });
    const preset = synthesize(ir);

    expect(preset.requiredModules).toBeDefined();
    expect(preset.requiredModules!.length).toBeGreaterThan(0);
  });
});
