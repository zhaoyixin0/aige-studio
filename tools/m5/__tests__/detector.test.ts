import { describe, it, expect } from 'vitest';
import { detectFormat } from '../detector.ts';

describe('detectFormat', () => {
  it('classifies knowledge format (has root + game_type)', () => {
    const data = {
      game_type: 'Puzzle_Memory',
      description: 'A memory game',
      examples: [],
      root: { objectName: 'Scene_Root', type: '2D', children: [] },
    };
    expect(detectFormat(data)).toBe('knowledge');
  });

  it('classifies knowledge format even without game_type (root is sufficient)', () => {
    const data = {
      description: 'Health bar',
      root: { objectName: 'Scene_Root', type: '2D' },
    };
    expect(detectFormat(data)).toBe('knowledge');
  });

  it('classifies sequence format (has top-level command_sequence array)', () => {
    const data = {
      description: 'Slingshot game',
      decompose_inputs: ['position', 'size', 'texture'],
      command_sequence: [
        { name: 'AddSceneObjectByConfig', arguments: { configId: 'ScreenImageEntity' }, index: 1 },
      ],
    };
    expect(detectFormat(data)).toBe('sequence');
  });

  it('classifies utility for snapshot format ({name, data})', () => {
    const data = {
      name: 'GetProjectSnapshot',
      data: { output: { scene: [] } },
    };
    expect(detectFormat(data)).toBe('utility');
  });

  it('classifies utility for named template collections', () => {
    const data = {
      Player_BoxCollider: {
        description: 'Player with box collider',
        command_sequence: [],
      },
      Player_CircleCollider: {
        description: 'Player with circle collider',
        command_sequence: [],
      },
    };
    expect(detectFormat(data)).toBe('utility');
  });

  it('classifies utility for single named entry', () => {
    const data = {
      game_audio_trigger: {
        description: 'Audio trigger setup',
        command_sequence: [],
      },
    };
    expect(detectFormat(data)).toBe('utility');
  });

  it('returns utility for null/undefined input', () => {
    expect(detectFormat(null)).toBe('utility');
    expect(detectFormat(undefined)).toBe('utility');
  });
});
