import { describe, it, expect } from 'vitest';
import {
  parseConfidence,
  extractSource,
  countModules,
  countByGameType,
  topByConfidence,
  pickFeatured,
  confidenceTier,
} from '../expert-utils.ts';
import type { PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';

function makePreset(overrides: Partial<PresetTemplate> = {}): PresetTemplate {
  return {
    id: 'expert-test',
    title: 'Test',
    description: 'A test preset [source: test_game.json]',
    gameType: 'catch',
    tags: ['expert-import', 'confidence:0.75'],
    params: [],
    sequence: { id: 'expert-test', commands: [] },
    requiredModules: ['GameFlow', 'Spawner', 'Collision'],
    ...overrides,
  };
}

describe('parseConfidence', () => {
  it('extracts confidence value from tags', () => {
    expect(parseConfidence(['expert-import', 'confidence:0.75'])).toBe(0.75);
  });

  it('returns null when no confidence tag', () => {
    expect(parseConfidence(['expert-import', 'knowledge'])).toBeNull();
  });

  it('handles edge case confidence:1.00', () => {
    expect(parseConfidence(['confidence:1.00'])).toBe(1.0);
  });

  it('returns null for malformed confidence tag', () => {
    expect(parseConfidence(['confidence:'])).toBeNull();
    expect(parseConfidence(['confidence:abc'])).toBeNull();
  });
});

describe('extractSource', () => {
  it('parses [source: X] from description', () => {
    const preset = makePreset({ description: 'A game [source: CardMatching_knowledge.json]' });
    expect(extractSource(preset)).toBe('CardMatching_knowledge.json');
  });

  it('returns null when no source in description', () => {
    const preset = makePreset({ description: 'A game without source info' });
    expect(extractSource(preset)).toBeNull();
  });
});

describe('countModules', () => {
  it('uses requiredModules length', () => {
    const preset = makePreset({ requiredModules: ['A', 'B', 'C', 'D'] });
    expect(countModules(preset)).toBe(4);
  });

  it('returns 0 when requiredModules undefined', () => {
    const preset = makePreset({ requiredModules: undefined });
    expect(countModules(preset)).toBe(0);
  });
});

describe('countByGameType', () => {
  it('produces correct counts', () => {
    const presets = [
      makePreset({ id: 'a', gameType: 'catch' }),
      makePreset({ id: 'b', gameType: 'catch' }),
      makePreset({ id: 'c', gameType: 'puzzle' }),
    ];
    const counts = countByGameType(presets);
    expect(counts.get('catch')).toBe(2);
    expect(counts.get('puzzle')).toBe(1);
    expect(counts.has('shooting')).toBe(false);
  });
});

describe('topByConfidence', () => {
  it('sorts descending with id tiebreaker', () => {
    const presets = [
      makePreset({ id: 'c', tags: ['confidence:0.50'] }),
      makePreset({ id: 'a', tags: ['confidence:0.85'] }),
      makePreset({ id: 'b', tags: ['confidence:0.85'] }),
    ];
    const top = topByConfidence(presets, 2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe('a'); // same confidence, lower id first
    expect(top[1].id).toBe('b');
  });
});

describe('pickFeatured', () => {
  it('returns non-null when presets available', () => {
    const presets = [
      makePreset({ id: 'x', tags: ['confidence:0.90'] }),
      makePreset({ id: 'y', tags: ['confidence:0.80'] }),
    ];
    const featured = pickFeatured(presets);
    expect(featured).not.toBeNull();
    expect(['x', 'y']).toContain(featured!.id);
  });

  it('returns null for empty array', () => {
    expect(pickFeatured([])).toBeNull();
  });
});

describe('confidenceTier', () => {
  it('classifies high >= 0.85', () => {
    expect(confidenceTier(0.85)).toBe('high');
    expect(confidenceTier(1.0)).toBe('high');
  });

  it('classifies medium 0.6-0.84', () => {
    expect(confidenceTier(0.6)).toBe('medium');
    expect(confidenceTier(0.75)).toBe('medium');
    expect(confidenceTier(0.84)).toBe('medium');
  });

  it('classifies low < 0.6', () => {
    expect(confidenceTier(0.4)).toBe('low');
    expect(confidenceTier(0.59)).toBe('low');
  });
});
