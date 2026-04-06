import { describe, it, expect } from 'vitest';
import { buildIR } from '../ir-builder.ts';
import type { ExpertIR } from '../types.ts';

describe('buildIR', () => {
  it('returns null for utility format', () => {
    const data = {
      Player_BoxCollider: { description: 'Player', command_sequence: [] },
    };
    expect(buildIR('player_template.json', data)).toBeNull();
  });

  it('returns null for snapshot format', () => {
    const data = { name: 'GetProjectSnapshot', data: { output: { scene: [] } } };
    expect(buildIR('ChimpionSwimmer.json', data)).toBeNull();
  });

  it('builds IR from knowledge format with game_type', () => {
    const data = {
      game_type: 'Puzzle_Memory',
      description: 'A pattern memory game played on a 3x4 grid.',
      examples: ['fantasy themed', 'casual puzzle'],
      root: {
        objectName: 'Scene_Root',
        type: '2D',
        children: [
          {
            objectName: 'Background Group',
            components: ['ExtraDataTransform', 'EffectNodeEditor'],
          },
          {
            objectName: 'Card Grid',
            components: ['GridLayoutManager', 'CardFlipController'],
          },
        ],
      },
    };
    const ir = buildIR('CardMatching_knowledge.json', data);
    expect(ir).not.toBeNull();
    const result = ir as ExpertIR;
    expect(result.id).toBe('expert-cardmatching-knowledge');
    expect(result.title).toContain('CardMatching');
    expect(result.description).toBe('A pattern memory game played on a 3x4 grid.');
    expect(result.gameTypeHint).toBe('Puzzle_Memory');
    expect(result.aigeGameType).toBe('puzzle');
    expect(result.sourcePath).toBe('CardMatching_knowledge.json');
    expect(result.tags).toContain('expert-import');
    expect(result.tags).toContain('knowledge');
  });

  it('builds IR from sequence format with decompose_inputs', () => {
    const data = {
      description: 'Create interactive 2D slingshot game components.',
      decompose_inputs: ['position', 'size', 'texture', 'velocity', 'opacity', 'radius'],
      command_sequence: [
        {
          name: 'AddSceneObjectByConfig',
          arguments: { configId: 'ScreenImageEntity' },
          comment: 'Create the slingshot base',
          index: 1,
        },
        {
          name: 'SetComponentProperty',
          arguments: {
            property: { texture: { asset: '${slingshot_base_texture}' } },
          },
          comment: 'Set texture',
          index: 2,
        },
      ],
    };
    const ir = buildIR('2D_AngryBirds_Slingshot_Game.json', data);
    expect(ir).not.toBeNull();
    const result = ir as ExpertIR;
    expect(result.id).toBe('expert-2d-angrybirds-slingshot-game');
    expect(result.aigeGameType).toBe('slingshot');
    expect(result.params.length).toBe(6);
    expect(result.params.map((p) => p.name)).toContain('position');
    expect(result.params.map((p) => p.name)).toContain('velocity');
    expect(result.tags).toContain('expert-import');
    expect(result.tags).toContain('sequence');
  });

  it('extracts assets from scene tree texture references', () => {
    const data = {
      game_type: 'Test',
      description: 'Test',
      root: {
        objectName: 'Root',
        children: [
          {
            objectName: 'Img1',
            componentsWithProperties: {
              ImageComponentEditor: {
                texture: { asset: 'bg_image.png' },
              },
            },
          },
        ],
      },
    };
    const ir = buildIR('test.json', data);
    expect(ir).not.toBeNull();
    expect(ir!.assets.length).toBeGreaterThanOrEqual(1);
    expect(ir!.assets[0].src).toBe('bg_image.png');
    expect(ir!.assets[0].type).toBe('image');
  });

  it('extracts assets from command sequence variable refs', () => {
    const data = {
      description: 'Test',
      decompose_inputs: ['texture'],
      command_sequence: [
        {
          name: 'SetComponentProperty',
          arguments: {
            property: { texture: { asset: '${ball_texture}' } },
          },
          index: 1,
        },
      ],
    };
    const ir = buildIR('test_sequence.json', data);
    expect(ir).not.toBeNull();
    expect(ir!.assets.length).toBeGreaterThanOrEqual(1);
    expect(ir!.assets.some((a) => a.src.includes('ball_texture'))).toBe(true);
  });

  it('generates stable IDs from filenames', () => {
    const data = { game_type: 'Test', description: 'Test', root: { objectName: 'Root' } };
    const ir1 = buildIR('2D_AngryBirds_Slingshot_Game.json', data);
    const ir2 = buildIR('2D_AngryBirds_Slingshot_Game.json', data);
    expect(ir1!.id).toBe(ir2!.id);
    expect(ir1!.id).toBe('expert-2d-angrybirds-slingshot-game');
  });

  it('collects unmapped EH components', () => {
    const data = {
      game_type: 'Test',
      description: 'Test',
      root: {
        objectName: 'Root',
        children: [
          {
            objectName: 'Node',
            components: ['ExtraDataTransform', 'EffectNodeEditor', 'FaceBindingComponent', 'UnknownCustomPlugin'],
          },
        ],
      },
    };
    const ir = buildIR('test.json', data);
    expect(ir).not.toBeNull();
    // Common EH components should be filtered out; truly unknown ones listed
    expect(ir!.unmappedComponents).toContain('FaceBindingComponent');
    expect(ir!.unmappedComponents).toContain('UnknownCustomPlugin');
    // Standard EH components should NOT be in unmapped
    expect(ir!.unmappedComponents).not.toContain('ExtraDataTransform');
    expect(ir!.unmappedComponents).not.toContain('EffectNodeEditor');
  });
});
