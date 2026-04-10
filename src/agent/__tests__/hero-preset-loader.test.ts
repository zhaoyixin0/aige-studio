// src/agent/__tests__/hero-preset-loader.test.ts
//
// TDD: loadHeroSkeleton converts hero-skeleton preset JSON into
// buildGameConfig-compatible params, so use_preset reuses the working
// create_game path.

import { describe, it, expect } from 'vitest';
import {
  loadHeroSkeleton,
  isHeroSkeleton,
} from '../hero-preset-loader.ts';

// ── Fixtures ────────────────────────────────────────────────────

const catchSkeleton = {
  id: 'hero-catch-fruit',
  kind: 'hero-skeleton',
  version: 2,
  gameType: 'catch',
  title: '经典接水果',
  description: '从天而降的水果接住得分',
  inputMethod: 'TouchInput',
  emphasis: { difficulty: 0.4, pacing: 0.5 },
  signature: {
    goods: ['火龙果', '香蕉', '草莓'],
    bads: ['炸弹'],
  },
} as const;

const whackSkeleton = {
  id: 'hero-whack-a-mole',
  kind: 'hero-skeleton',
  version: 2,
  gameType: 'tap', // whack-a-mole falls back to tap
  title: '经典打地鼠',
  description: '快速点击冒出的目标得分',
  inputMethod: 'TouchInput',
  emphasis: { difficulty: 0.5, pacing: 0.7 },
  signature: {
    goods: ['地鼠', '金币地鼠'],
    bads: ['炸弹地鼠'],
  },
} as const;

const runnerSkeleton = {
  id: 'hero-endless-runner',
  kind: 'hero-skeleton',
  version: 2,
  gameType: 'runner',
  title: '无尽跑酷',
  description: '无尽奔跑',
  inputMethod: 'TouchInput',
  emphasis: { difficulty: 0.6, pacing: 0.9 },
  signature: {
    goods: ['金币', '星星'],
    bads: ['路障', '坑'],
  },
} as const;

// ── isHeroSkeleton type guard ───────────────────────────────────

describe('isHeroSkeleton', () => {
  it('returns true for valid hero-skeleton objects', () => {
    expect(isHeroSkeleton(catchSkeleton)).toBe(true);
  });

  it('returns false for objects missing kind', () => {
    const { kind: _unused, ...noKind } = catchSkeleton;
    void _unused;
    expect(isHeroSkeleton(noKind)).toBe(false);
  });

  it('returns false for objects with wrong kind', () => {
    expect(isHeroSkeleton({ ...catchSkeleton, kind: 'other' })).toBe(false);
  });

  it('returns false for non-object inputs', () => {
    expect(isHeroSkeleton(null)).toBe(false);
    expect(isHeroSkeleton('str')).toBe(false);
    expect(isHeroSkeleton(42)).toBe(false);
  });

  it('returns false for legacy preset (no kind field, has sequence)', () => {
    const legacy = {
      id: 'hero-catch-fruit',
      title: 't',
      gameType: 'catch',
      tags: [],
      params: [],
      sequence: { id: 'x', commands: [] },
    };
    expect(isHeroSkeleton(legacy)).toBe(false);
  });
});

// ── loadHeroSkeleton: success cases ─────────────────────────────

describe('loadHeroSkeleton — success', () => {
  it('returns createParams with game_type and input_method (catch)', () => {
    const result = loadHeroSkeleton(catchSkeleton);
    expect(result.heroPresetId).toBe('hero-catch-fruit');
    expect(result.createParams.game_type).toBe('catch');
    expect(result.createParams.input_method).toBe('TouchInput');
  });

  it('expands signature.goods into asset_descriptions good_1, good_2, good_3', () => {
    const result = loadHeroSkeleton(catchSkeleton);
    const descs = result.createParams.asset_descriptions;
    expect(descs).toBeDefined();
    expect(descs?.good_1).toBe('火龙果');
    expect(descs?.good_2).toBe('香蕉');
    expect(descs?.good_3).toBe('草莓');
  });

  it('expands signature.bads into asset_descriptions bad_1', () => {
    const result = loadHeroSkeleton(catchSkeleton);
    expect(result.createParams.asset_descriptions?.bad_1).toBe('炸弹');
  });

  it('expands multiple bads correctly', () => {
    const result = loadHeroSkeleton(runnerSkeleton);
    const descs = result.createParams.asset_descriptions;
    expect(descs?.bad_1).toBe('路障');
    expect(descs?.bad_2).toBe('坑');
  });

  it('maps difficulty=0.4 to a reasonable duration (catch)', () => {
    const result = loadHeroSkeleton(catchSkeleton);
    expect(result.createParams.duration).toBeGreaterThanOrEqual(20);
    expect(result.createParams.duration).toBeLessThanOrEqual(60);
  });

  it('higher difficulty maps to longer duration', () => {
    const low = loadHeroSkeleton({
      ...catchSkeleton,
      emphasis: { difficulty: 0.1 },
    });
    const high = loadHeroSkeleton({
      ...catchSkeleton,
      emphasis: { difficulty: 0.9 },
    });
    expect(high.createParams.duration!).toBeGreaterThan(low.createParams.duration!);
  });

  it('maps difficulty=0.9 to approximately 60s', () => {
    const result = loadHeroSkeleton({
      ...catchSkeleton,
      emphasis: { difficulty: 0.9 },
    });
    expect(result.createParams.duration).toBeGreaterThanOrEqual(50);
    expect(result.createParams.duration).toBeLessThanOrEqual(70);
  });

  it('handles whack-a-mole mapped to tap gameType', () => {
    const result = loadHeroSkeleton(whackSkeleton);
    expect(result.createParams.game_type).toBe('tap');
    expect(result.createParams.asset_descriptions?.good_1).toBe('地鼠');
  });

  it('handles runner gameType', () => {
    const result = loadHeroSkeleton(runnerSkeleton);
    expect(result.createParams.game_type).toBe('runner');
    expect(result.createParams.asset_descriptions?.good_1).toBe('金币');
  });

  it('passes through extraModules to extra_modules', () => {
    const input = { ...catchSkeleton, extraModules: ['ParticleVFX', 'SoundFX'] };
    const result = loadHeroSkeleton(input);
    expect(result.createParams.extra_modules).toEqual(['ParticleVFX', 'SoundFX']);
  });

  it('does not mutate the input object', () => {
    const input = JSON.parse(JSON.stringify(catchSkeleton));
    const snapshot = JSON.parse(JSON.stringify(input));
    loadHeroSkeleton(input);
    expect(input).toEqual(snapshot);
  });
});

// ── loadHeroSkeleton: degraded cases ────────────────────────────

describe('loadHeroSkeleton — degraded', () => {
  it('handles missing signature (no asset_descriptions)', () => {
    const { signature: _sig, ...noSig } = catchSkeleton;
    void _sig;
    const result = loadHeroSkeleton(noSig);
    expect(result.createParams.asset_descriptions).toBeUndefined();
  });

  it('handles missing emphasis (no duration override)', () => {
    const { emphasis: _em, ...noEmph } = catchSkeleton;
    void _em;
    const result = loadHeroSkeleton(noEmph);
    expect(result.createParams.duration).toBeUndefined();
  });

  it('handles empty signature.goods array', () => {
    const result = loadHeroSkeleton({
      ...catchSkeleton,
      signature: { goods: [], bads: ['炸弹'] },
    });
    expect(result.createParams.asset_descriptions?.good_1).toBeUndefined();
    expect(result.createParams.asset_descriptions?.bad_1).toBe('炸弹');
  });

  it('handles signature with only goods (no bads)', () => {
    const result = loadHeroSkeleton({
      ...catchSkeleton,
      signature: { goods: ['卡牌'] },
    });
    expect(result.createParams.asset_descriptions?.good_1).toBe('卡牌');
    expect(result.createParams.asset_descriptions?.bad_1).toBeUndefined();
  });

  it('merges assetHints into asset_descriptions (hints override signature)', () => {
    const result = loadHeroSkeleton({
      ...catchSkeleton,
      assetHints: { player: '卡通英雄', good_1: '闪亮水果' },
    });
    const descs = result.createParams.asset_descriptions;
    expect(descs?.player).toBe('卡通英雄');
    // hints should take precedence
    expect(descs?.good_1).toBe('闪亮水果');
  });

  it('omits input_method when inputMethod is undefined', () => {
    const { inputMethod: _im, ...noInput } = catchSkeleton;
    void _im;
    const result = loadHeroSkeleton(noInput);
    expect(result.createParams.input_method).toBeUndefined();
  });
});

// ── loadHeroSkeleton: validation errors ─────────────────────────

describe('loadHeroSkeleton — validation errors', () => {
  it('throws for null input', () => {
    expect(() => loadHeroSkeleton(null)).toThrow();
  });

  it('throws for non-object input', () => {
    expect(() => loadHeroSkeleton('not-an-object')).toThrow();
  });

  it('throws when kind is missing', () => {
    const { kind: _k, ...noKind } = catchSkeleton;
    void _k;
    expect(() => loadHeroSkeleton(noKind)).toThrow(/hero-skeleton/);
  });

  it('throws when kind is not hero-skeleton', () => {
    expect(() =>
      loadHeroSkeleton({ ...catchSkeleton, kind: 'legacy' }),
    ).toThrow(/hero-skeleton/);
  });

  it('throws when version is not 2', () => {
    expect(() =>
      loadHeroSkeleton({ ...catchSkeleton, version: 1 }),
    ).toThrow(/version/);
  });

  it('throws when id is missing', () => {
    const { id: _i, ...noId } = catchSkeleton;
    void _i;
    expect(() => loadHeroSkeleton(noId)).toThrow(/id/);
  });

  it('throws when gameType is missing', () => {
    const { gameType: _g, ...noType } = catchSkeleton;
    void _g;
    expect(() => loadHeroSkeleton(noType)).toThrow(/gameType/);
  });
});
