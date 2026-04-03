import { describe, it, expect } from 'vitest';
import { resolveVisibility, validateDag } from '../dependency-resolver';
import type { ParameterMeta } from '../../../data/parameter-registry';
import { PARAMETER_REGISTRY } from '../../../data/parameter-registry';

function makeParam(
  overrides: Partial<ParameterMeta> & Pick<ParameterMeta, 'id'>
): ParameterMeta {
  return {
    name: overrides.id,
    layer: 'L2',
    category: 'game_mechanics',
    mvp: 'P0',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: true,
    description: 'test',
    ...overrides,
  };
}

describe('resolveVisibility', () => {
  it('returns all params as visible/enabled when no dependencies exist', () => {
    const params = [
      makeParam({ id: 'a' }),
      makeParam({ id: 'b' }),
      makeParam({ id: 'c' }),
    ];
    const values = new Map<string, unknown>([
      ['a', true],
      ['b', false],
      ['c', '中'],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('a')).toEqual({ visible: true, enabled: true });
    expect(result.get('b')).toEqual({ visible: true, enabled: true });
    expect(result.get('c')).toEqual({ visible: true, enabled: true });
  });

  it('hides child param when parent toggle is off (condition: 开启)', () => {
    const params = [
      makeParam({ id: 'parent', options: ['开启', '关闭'] }),
      makeParam({
        id: 'child',
        dependsOn: { paramId: 'parent', condition: '开启' },
      }),
    ];
    const values = new Map<string, unknown>([
      ['parent', false],
      ['child', true],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('parent')).toEqual({ visible: true, enabled: true });
    expect(result.get('child')).toEqual({ visible: false, enabled: false });
  });

  it('shows child param when parent toggle is on', () => {
    const params = [
      makeParam({ id: 'parent', options: ['开启', '关闭'] }),
      makeParam({
        id: 'child',
        dependsOn: { paramId: 'parent', condition: '开启' },
      }),
    ];
    const values = new Map<string, unknown>([
      ['parent', true],
      ['child', 'some_value'],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('parent')).toEqual({ visible: true, enabled: true });
    expect(result.get('child')).toEqual({ visible: true, enabled: true });
  });

  it('handles chain dependencies (A→B→C): if A is off, both B and C are hidden', () => {
    const params = [
      makeParam({ id: 'A', options: ['开启', '关闭'] }),
      makeParam({
        id: 'B',
        options: ['开启', '关闭'],
        dependsOn: { paramId: 'A', condition: '开启' },
      }),
      makeParam({
        id: 'C',
        dependsOn: { paramId: 'B', condition: '开启' },
      }),
    ];
    const values = new Map<string, unknown>([
      ['A', false],
      ['B', true],
      ['C', true],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('A')).toEqual({ visible: true, enabled: true });
    expect(result.get('B')).toEqual({ visible: false, enabled: false });
    expect(result.get('C')).toEqual({ visible: false, enabled: false });
  });

  it('handles fork: one parent controls multiple children', () => {
    const params = [
      makeParam({ id: 'parent', options: ['显示', '隐藏'] }),
      makeParam({
        id: 'child1',
        dependsOn: { paramId: 'parent', condition: '显示' },
      }),
      makeParam({
        id: 'child2',
        dependsOn: { paramId: 'parent', condition: '显示' },
      }),
      makeParam({
        id: 'child3',
        dependsOn: { paramId: 'parent', condition: '显示' },
      }),
    ];
    const values = new Map<string, unknown>([
      ['parent', false],
      ['child1', true],
      ['child2', true],
      ['child3', true],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('parent')).toEqual({ visible: true, enabled: true });
    expect(result.get('child1')).toEqual({ visible: false, enabled: false });
    expect(result.get('child2')).toEqual({ visible: false, enabled: false });
    expect(result.get('child3')).toEqual({ visible: false, enabled: false });
  });

  it('returns empty map for empty registry', () => {
    const result = resolveVisibility([], new Map());

    expect(result.size).toBe(0);
  });

  it('ignores params with dependsOn pointing to non-existent paramId (graceful)', () => {
    const params = [
      makeParam({
        id: 'orphan',
        dependsOn: { paramId: 'does_not_exist', condition: '开启' },
      }),
      makeParam({ id: 'normal' }),
    ];
    const values = new Map<string, unknown>([
      ['orphan', true],
      ['normal', true],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('orphan')).toEqual({ visible: true, enabled: true });
    expect(result.get('normal')).toEqual({ visible: true, enabled: true });
  });

  it('matches condition "显示" when parent value is truthy', () => {
    const params = [
      makeParam({ id: 'ui', options: ['显示', '隐藏'] }),
      makeParam({
        id: 'score_display',
        dependsOn: { paramId: 'ui', condition: '显示' },
      }),
    ];

    // parent is truthy string '显示'
    const values1 = new Map<string, unknown>([
      ['ui', '显示'],
      ['score_display', true],
    ]);
    expect(resolveVisibility(params, values1).get('score_display')).toEqual({
      visible: true,
      enabled: true,
    });

    // parent is true (boolean truthy)
    const values2 = new Map<string, unknown>([
      ['ui', true],
      ['score_display', true],
    ]);
    expect(resolveVisibility(params, values2).get('score_display')).toEqual({
      visible: true,
      enabled: true,
    });

    // parent is false → hidden
    const values3 = new Map<string, unknown>([
      ['ui', false],
      ['score_display', true],
    ]);
    expect(resolveVisibility(params, values3).get('score_display')).toEqual({
      visible: false,
      enabled: false,
    });
  });

  it('condition "任意" always passes when parent is visible', () => {
    const params = [
      makeParam({ id: 'style' }),
      makeParam({
        id: 'asset',
        dependsOn: { paramId: 'style', condition: '任意' },
      }),
    ];
    const values = new Map<string, unknown>([
      ['style', '经典'],
      ['asset', '默认'],
    ]);

    const result = resolveVisibility(params, values);

    expect(result.get('asset')).toEqual({ visible: true, enabled: true });
  });
});

describe('validateDag', () => {
  it('returns valid: true for valid DAG (no cycles)', () => {
    const params = [
      makeParam({ id: 'A' }),
      makeParam({
        id: 'B',
        dependsOn: { paramId: 'A', condition: '开启' },
      }),
      makeParam({
        id: 'C',
        dependsOn: { paramId: 'B', condition: '开启' },
      }),
    ];

    const result = validateDag(params);

    expect(result.valid).toBe(true);
    expect(result.cyclePath).toBeUndefined();
  });

  it('returns valid: false and reports cycle path for circular deps', () => {
    // Manually create circular: A→B→C→A
    const params = [
      makeParam({
        id: 'A',
        dependsOn: { paramId: 'C', condition: '开启' },
      }),
      makeParam({
        id: 'B',
        dependsOn: { paramId: 'A', condition: '开启' },
      }),
      makeParam({
        id: 'C',
        dependsOn: { paramId: 'B', condition: '开启' },
      }),
    ];

    const result = validateDag(params);

    expect(result.valid).toBe(false);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(2);
  });

  it('returns valid: true for empty registry', () => {
    const result = validateDag([]);

    expect(result.valid).toBe(true);
    expect(result.cyclePath).toBeUndefined();
  });

  it('returns valid: true for params with no dependencies', () => {
    const params = [
      makeParam({ id: 'A' }),
      makeParam({ id: 'B' }),
      makeParam({ id: 'C' }),
    ];

    const result = validateDag(params);

    expect(result.valid).toBe(true);
  });

  it('works with real PARAMETER_REGISTRY data (no cycles, all deps valid)', () => {
    const result = validateDag(PARAMETER_REGISTRY);

    expect(result.valid).toBe(true);
    expect(result.cyclePath).toBeUndefined();
  });
});
