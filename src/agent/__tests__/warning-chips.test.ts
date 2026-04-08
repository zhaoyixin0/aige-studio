/**
 * TDD: mapWarningsToChips — converts ValidationIssue[] to actionable Chip[]
 */
import { describe, it, expect } from 'vitest';
import { mapWarningsToChips } from '../conversation-helpers';
import type { ValidationIssue } from '@/engine/core/config-validator';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeIssue(
  category: ValidationIssue['category'],
  moduleId = 'mod_1',
): ValidationIssue {
  return {
    severity: 'warning',
    category,
    moduleId,
    message: `test warning for ${category}`,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('mapWarningsToChips', () => {
  it('returns empty array for empty warnings', () => {
    expect(mapWarningsToChips([])).toEqual([]);
  });

  it('maps missing-input warning to add:TouchInput chip', () => {
    const chips = mapWarningsToChips([makeIssue('missing-input')]);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('add:TouchInput');
    expect(chips[0].label).toBe('添加输入模块');
  });

  it('maps event-chain-break warning to fix:event-chain chip', () => {
    const chips = mapWarningsToChips([makeIssue('event-chain-break')]);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('fix:event-chain');
    expect(chips[0].type).toBe('board_mode');
    expect(chips[0].label).toBe('打开调试面板');
  });

  it('maps module-conflict warning to remove chip using moduleId', () => {
    const chips = mapWarningsToChips([makeIssue('module-conflict', 'timer_2')]);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('remove:timer_2');
    expect(chips[0].label).toBe('移除重复模块');
  });

  it('maps module-conflict warning with unknown moduleId as fallback', () => {
    const issue: ValidationIssue = {
      severity: 'warning',
      category: 'module-conflict',
      moduleId: '',
      message: 'conflict',
    };
    const chips = mapWarningsToChips([issue]);
    expect(chips[0].id).toBe('remove:');
  });

  it('maps invalid-param warning to fix:params chip', () => {
    const chips = mapWarningsToChips([makeIssue('invalid-param')]);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('fix:params');
    expect(chips[0].type).toBe('board_mode');
    expect(chips[0].label).toBe('调整参数');
  });

  it('caps output at maxChips (default 3)', () => {
    const warnings: ValidationIssue[] = [
      makeIssue('missing-input', 'pm_1'),
      makeIssue('event-chain-break', 'scorer_1'),
      makeIssue('module-conflict', 'timer_2'),
      makeIssue('invalid-param', 'spawner_1'),
    ];
    const chips = mapWarningsToChips(warnings);
    expect(chips).toHaveLength(3);
  });

  it('respects custom maxChips parameter', () => {
    const warnings: ValidationIssue[] = [
      makeIssue('missing-input'),
      makeIssue('event-chain-break'),
      makeIssue('module-conflict'),
      makeIssue('invalid-param'),
    ];
    expect(mapWarningsToChips(warnings, 1)).toHaveLength(1);
    expect(mapWarningsToChips(warnings, 2)).toHaveLength(2);
    expect(mapWarningsToChips(warnings, 10)).toHaveLength(4);
  });

  it('deduplicates chips with the same id', () => {
    const warnings: ValidationIssue[] = [
      makeIssue('missing-input', 'pm_1'),
      makeIssue('missing-input', 'pm_2'),
      makeIssue('event-chain-break', 'scorer_1'),
    ];
    const chips = mapWarningsToChips(warnings);
    const ids = chips.map((c) => c.id);
    expect(ids).toEqual(['add:TouchInput', 'fix:event-chain']);
  });

  it('produces unique ids for multiple module-conflict warnings with different moduleIds', () => {
    const warnings: ValidationIssue[] = [
      makeIssue('module-conflict', 'timer_2'),
      makeIssue('module-conflict', 'lives_2'),
    ];
    const chips = mapWarningsToChips(warnings);
    expect(chips).toHaveLength(2);
    expect(chips[0].id).toBe('remove:timer_2');
    expect(chips[1].id).toBe('remove:lives_2');
  });

  it('silently skips unrecognised category values', () => {
    const issue = {
      severity: 'warning' as const,
      category: 'unknown-module' as ValidationIssue['category'],
      moduleId: 'x_1',
      message: 'unknown',
    };
    const chips = mapWarningsToChips([issue]);
    expect(chips).toHaveLength(0);
  });

  it('each chip has at minimum id and label properties', () => {
    const warnings: ValidationIssue[] = [
      makeIssue('missing-input'),
      makeIssue('event-chain-break'),
      makeIssue('module-conflict'),
      makeIssue('invalid-param'),
    ];
    for (const chip of mapWarningsToChips(warnings)) {
      expect(typeof chip.id).toBe('string');
      expect(chip.id.length).toBeGreaterThan(0);
      expect(typeof chip.label).toBe('string');
      expect(chip.label.length).toBeGreaterThan(0);
    }
  });
});
