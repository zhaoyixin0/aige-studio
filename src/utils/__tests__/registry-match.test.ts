import { describe, it, expect } from 'vitest';
import {
  resolveDependencyName,
  normalizeName,
  stripSuffix,
} from '../registry-match';

describe('normalizeName', () => {
  it('strips punctuation, whitespace, and lowercases', () => {
    expect(normalizeName(' Beat-Map 节奏 ')).toBe('beatmap节奏');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeName('')).toBe('');
  });
});

describe('stripSuffix', () => {
  it('strips 系统', () => {
    expect(stripSuffix('跑酷系统')).toBe('跑酷');
  });

  it('strips 模式', () => {
    expect(stripSuffix('得分模式')).toBe('得分');
  });

  it('strips 设置', () => {
    expect(stripSuffix('难度设置')).toBe('难度');
  });

  it('strips 效果', () => {
    expect(stripSuffix('粒子效果')).toBe('粒子');
  });

  it('does not strip if result would be empty', () => {
    expect(stripSuffix('系统')).toBe('系统');
  });

  it('returns original if no suffix matches', () => {
    expect(stripSuffix('跑酷')).toBe('跑酷');
  });
});

describe('resolveDependencyName', () => {
  const nameToId = new Map<string, string>([
    ['Spawner 速度范围', 'gm_001'],
    ['Spawner 频率', 'gm_002'],
    ['Beat Map 节奏', 'va_010'],
    ['跑酷', 'gm_010'],
    ['得分', 'gm_011'],
    ['粒子', 'va_020'],
  ]);

  // Step 1: Exact match
  it('matches exact names', () => {
    const r = resolveDependencyName(nameToId, 'Spawner 频率');
    expect(r.id).toBe('gm_002');
  });

  // Step 2: Normalized equality (strip punctuation, whitespace, case)
  it('matches via normalized equality', () => {
    const r = resolveDependencyName(nameToId, 'Beat-Map节奏');
    expect(r.id).toBe('va_010');
  });

  it('matches via normalized equality ignoring case', () => {
    const r = resolveDependencyName(nameToId, 'spawner 频率');
    expect(r.id).toBe('gm_002');
  });

  // Step 3: Suffix-stripped match
  it('matches via suffix stripping (系统)', () => {
    const r = resolveDependencyName(nameToId, '跑酷系统');
    expect(r.id).toBe('gm_010');
  });

  it('matches via suffix stripping (模式)', () => {
    const r = resolveDependencyName(nameToId, '得分模式');
    expect(r.id).toBe('gm_011');
  });

  it('matches via suffix stripping (效果)', () => {
    const r = resolveDependencyName(nameToId, '粒子效果');
    expect(r.id).toBe('va_020');
  });

  // Step 4: No match — returns undefined, no wrong edges
  it('returns no match for completely unknown name', () => {
    const r = resolveDependencyName(nameToId, '魔法系统');
    expect(r.id).toBeUndefined();
    expect(r.ambiguity).toBeUndefined();
  });

  // CRITICAL: substring/includes must NOT match
  it('does NOT match via substring/includes (防止错误DAG边)', () => {
    // '频率' is a substring of 'Spawner 频率', but should NOT match
    // because we removed token overlap
    const r = resolveDependencyName(nameToId, '频率');
    expect(r.id).toBeUndefined();
  });

  it('does NOT match via substring/includes for partial name', () => {
    const r = resolveDependencyName(nameToId, 'Spawner');
    expect(r.id).toBeUndefined();
  });

  // Suffix-stripped ambiguity: two entries match after suffix strip → no match
  it('returns ambiguity when suffix stripping yields multiple matches', () => {
    const ambiguousMap = new Map<string, string>([
      ['跑酷A', 'gm_001'],
      ['跑酷B', 'gm_002'],
    ]);
    // '跑酷系统' → stripped to '跑酷', but neither '跑酷A' nor '跑酷B' normalized matches '跑酷'
    const r = resolveDependencyName(ambiguousMap, '跑酷系统');
    expect(r.id).toBeUndefined();
  });

  // Suffix stripping on both sides
  it('matches when both dependency and registered name need suffix stripping', () => {
    const mapWithSuffix = new Map<string, string>([
      ['跑酷系统', 'gm_010'],
    ]);
    // '跑酷效果' → stripped to '跑酷', '跑酷系统' → stripped to '跑酷' → match
    const r = resolveDependencyName(mapWithSuffix, '跑酷效果');
    expect(r.id).toBe('gm_010');
  });
});
