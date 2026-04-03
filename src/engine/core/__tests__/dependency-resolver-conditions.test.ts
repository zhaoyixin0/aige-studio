import { describe, it, expect } from 'vitest';
import { resolveVisibility, matchesCondition, isTruthy } from '../dependency-resolver';
import type { ParameterMeta } from '@/data/parameter-registry';

function visOf(depCond: string, parentValue: unknown): boolean {
  const params: ParameterMeta[] = [
    {
      id: 'parent',
      name: 'Parent',
      layer: 'L2',
      category: 'game_mechanics',
      mvp: 'P1',
      exposure: 'direct',
      controlType: 'toggle',
      gameTypes: ['ALL'],
      defaultValue: false,
      description: '',
    },
    {
      id: 'child',
      name: 'Child',
      layer: 'L2',
      category: 'game_mechanics',
      mvp: 'P1',
      exposure: 'direct',
      controlType: 'toggle',
      gameTypes: ['ALL'],
      defaultValue: false,
      description: '',
      dependsOn: { paramId: 'parent', condition: depCond },
    },
  ];
  const current = new Map<string, unknown>([['parent', parentValue]]);
  return resolveVisibility(params, current).get('child')!.visible;
}

// ── isTruthy direct unit tests ──────────────────────────────────────
describe('isTruthy', () => {
  it('boolean true → truthy', () => {
    expect(isTruthy(true)).toBe(true);
  });

  it('boolean false → falsy', () => {
    expect(isTruthy(false)).toBe(false);
  });

  it('non-zero numbers → truthy', () => {
    expect(isTruthy(1)).toBe(true);
    expect(isTruthy(42)).toBe(true);
    expect(isTruthy(-1)).toBe(true);
    expect(isTruthy(0.5)).toBe(true);
  });

  it('zero → falsy', () => {
    expect(isTruthy(0)).toBe(false);
  });

  it('null and undefined → falsy', () => {
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
  });

  it('empty / whitespace-only string → falsy', () => {
    expect(isTruthy('')).toBe(false);
    expect(isTruthy('  ')).toBe(false);
  });

  it('string "0" → falsy', () => {
    expect(isTruthy('0')).toBe(false);
  });

  it('truthy Chinese keywords', () => {
    expect(isTruthy('开启')).toBe(true);
    expect(isTruthy('显示')).toBe(true);
  });

  it('falsy Chinese keywords', () => {
    expect(isTruthy('关闭')).toBe(false);
    expect(isTruthy('隐藏')).toBe(false);
  });

  it('truthy English keywords', () => {
    expect(isTruthy('true')).toBe(true);
    expect(isTruthy('on')).toBe(true);
    expect(isTruthy('yes')).toBe(true);
    expect(isTruthy('enabled')).toBe(true);
  });

  it('falsy English keywords', () => {
    expect(isTruthy('false')).toBe(false);
    expect(isTruthy('off')).toBe(false);
    expect(isTruthy('no')).toBe(false);
    expect(isTruthy('disabled')).toBe(false);
  });

  it('case-insensitive string keywords', () => {
    expect(isTruthy('TRUE')).toBe(true);
    expect(isTruthy('True')).toBe(true);
    expect(isTruthy('FALSE')).toBe(false);
    expect(isTruthy('ON')).toBe(true);
    expect(isTruthy('OFF')).toBe(false);
  });

  it('non-empty non-keyword strings → truthy', () => {
    expect(isTruthy('hello')).toBe(true);
    expect(isTruthy('普通')).toBe(true);
    expect(isTruthy('经典')).toBe(true);
  });
});

// ── matchesCondition direct unit tests ──────────────────────────────
describe('matchesCondition', () => {
  describe('wildcards', () => {
    it('"*" always matches regardless of value', () => {
      expect(matchesCondition('*', true)).toBe(true);
      expect(matchesCondition('*', false)).toBe(true);
      expect(matchesCondition('*', 0)).toBe(true);
      expect(matchesCondition('*', '')).toBe(true);
      expect(matchesCondition('*', null)).toBe(true);
    });

    it('"any" always matches', () => {
      expect(matchesCondition('any', false)).toBe(true);
      expect(matchesCondition('any', 0)).toBe(true);
    });

    it('"任意" always matches', () => {
      expect(matchesCondition('任意', false)).toBe(true);
      expect(matchesCondition('任意', '关闭')).toBe(true);
    });

    it('wildcards are case-insensitive', () => {
      expect(matchesCondition('ANY', null)).toBe(true);
      expect(matchesCondition('Any', 0)).toBe(true);
    });
  });

  describe('truthy condition keywords', () => {
    const keywords = ['true', 'on', 'yes', 'enabled', '开启', '显示', 'visible'];

    for (const kw of keywords) {
      it(`"${kw}" matches truthy value (boolean true)`, () => {
        expect(matchesCondition(kw, true)).toBe(true);
      });

      it(`"${kw}" does NOT match falsy value (boolean false)`, () => {
        expect(matchesCondition(kw, false)).toBe(false);
      });

      it(`"${kw}" matches non-zero number`, () => {
        expect(matchesCondition(kw, 42)).toBe(true);
      });

      it(`"${kw}" does NOT match zero`, () => {
        expect(matchesCondition(kw, 0)).toBe(false);
      });

      it(`"${kw}" does NOT match empty string`, () => {
        expect(matchesCondition(kw, '')).toBe(false);
      });
    }
  });

  describe('falsy condition keywords', () => {
    const keywords = ['false', 'off', 'no', 'disabled', '关闭', '隐藏', 'hidden'];

    for (const kw of keywords) {
      it(`"${kw}" matches falsy value (boolean false)`, () => {
        expect(matchesCondition(kw, false)).toBe(true);
      });

      it(`"${kw}" does NOT match truthy value (boolean true)`, () => {
        expect(matchesCondition(kw, true)).toBe(false);
      });

      it(`"${kw}" matches zero`, () => {
        expect(matchesCondition(kw, 0)).toBe(true);
      });

      it(`"${kw}" does NOT match non-zero number`, () => {
        expect(matchesCondition(kw, 42)).toBe(false);
      });
    }
  });

  describe('case insensitivity for keywords', () => {
    it('"TRUE" behaves like "true"', () => {
      expect(matchesCondition('TRUE', true)).toBe(true);
      expect(matchesCondition('TRUE', false)).toBe(false);
    });

    it('"FALSE" behaves like "false"', () => {
      expect(matchesCondition('FALSE', false)).toBe(true);
      expect(matchesCondition('FALSE', true)).toBe(false);
    });

    it('"Enabled" behaves like "enabled"', () => {
      expect(matchesCondition('Enabled', true)).toBe(true);
      expect(matchesCondition('Enabled', false)).toBe(false);
    });
  });

  describe('exact string equality fallback', () => {
    it('matches when string value equals condition (Chinese)', () => {
      expect(matchesCondition('普通', '普通')).toBe(true);
    });

    it('does not match when string value differs', () => {
      expect(matchesCondition('普通', '困难')).toBe(false);
    });

    it('case-insensitive string equality', () => {
      expect(matchesCondition('normal', 'Normal')).toBe(true);
      expect(matchesCondition('Normal', 'normal')).toBe(true);
    });

    it('does not match non-string values for unknown conditions', () => {
      expect(matchesCondition('普通', 42)).toBe(false);
      expect(matchesCondition('普通', true)).toBe(false);
    });
  });

  describe('emptiness checks', () => {
    it('"empty" / "空" matches null, undefined, and empty/whitespace string', () => {
      expect(matchesCondition('empty', null)).toBe(true);
      expect(matchesCondition('empty', undefined)).toBe(true);
      expect(matchesCondition('empty', '')).toBe(true);
      expect(matchesCondition('empty', '  ')).toBe(true);
      expect(matchesCondition('空', null)).toBe(true);
    });

    it('"empty" does not match non-empty values', () => {
      expect(matchesCondition('empty', 'hello')).toBe(false);
      expect(matchesCondition('empty', 0)).toBe(false);
    });

    it('"not-empty" / "非空" matches non-empty values', () => {
      expect(matchesCondition('not-empty', 'hello')).toBe(true);
      expect(matchesCondition('not-empty', 0)).toBe(true);
      expect(matchesCondition('非空', 'hello')).toBe(true);
    });

    it('"not-empty" does not match null/undefined/empty', () => {
      expect(matchesCondition('not-empty', null)).toBe(false);
      expect(matchesCondition('not-empty', undefined)).toBe(false);
      expect(matchesCondition('not-empty', '')).toBe(false);
    });
  });
});

// ── Integration tests via resolveVisibility ─────────────────────────
describe('dependency-resolver condition matching (via resolveVisibility)', () => {
  it('supports any/* wildcard', () => {
    expect(visOf('任意', false)).toBe(true);
    expect(visOf('any', false)).toBe(true);
    expect(visOf('*', false)).toBe(true);
  });

  it('handles truthy/falsy multilingual keywords', () => {
    for (const kw of ['开启', '显示', 'on', 'enabled', 'true', 'yes', 'visible']) {
      expect(visOf(kw, true)).toBe(true);
      expect(visOf(kw, 'hello')).toBe(true);
      expect(visOf(kw, 1)).toBe(true);
    }
    for (const kw of ['关闭', '隐藏', 'off', 'disabled', 'false', 'no', 'hidden']) {
      expect(visOf(kw, false)).toBe(true);
      expect(visOf(kw, 0)).toBe(true);
      expect(visOf(kw, '')).toBe(true);
    }
  });

  it('treats empty and not-empty correctly', () => {
    expect(visOf('empty', '')).toBe(true);
    expect(visOf('empty', null)).toBe(true);
    expect(visOf('empty', undefined)).toBe(true);
    expect(visOf('not-empty', 'x')).toBe(true);
    expect(visOf('非空', 'y')).toBe(true);
  });

  it('falls back to case-insensitive equality for strings', () => {
    expect(visOf('hard', 'HARD')).toBe(true);
    expect(visOf('medium', 'easy')).toBe(false);
  });
});

