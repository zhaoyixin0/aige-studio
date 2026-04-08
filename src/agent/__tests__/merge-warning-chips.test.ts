/**
 * TDD: appendWarningChips merge logic
 *
 * Tests cover the merge-and-dedupe behavior when warning chips are appended
 * to existing V2 creation chips in ConversationAgent.
 */
import { describe, it, expect } from 'vitest';
import { mapWarningsToChips } from '../conversation-helpers';
import type { Chip } from '../conversation-defs';
import type { ValidationIssue } from '@/engine/core/config-validator';

// ── helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Pure helper extracted from ConversationAgent's merge logic.
 * Appends warning chips to existingChips, deduplicating by id.
 * Uses maxChips=2 to avoid chip row overflow.
 */
function appendWarningChips(
  existingChips: Chip[] | null | undefined,
  warnings: ValidationIssue[],
): Chip[] {
  if (warnings.length === 0) {
    return existingChips ?? [];
  }
  const warningChips = mapWarningsToChips(warnings, 2);
  if (warningChips.length === 0) {
    return existingChips ?? [];
  }
  const existingIds = new Set((existingChips ?? []).map((c) => c.id));
  const newWarningChips = warningChips.filter((c) => !existingIds.has(c.id));
  if (newWarningChips.length === 0) {
    return existingChips ?? [];
  }
  return [...(existingChips ?? []), ...newWarningChips];
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('appendWarningChips', () => {
  it('appends warning chips to existing V2 creation chips', () => {
    const existingChips: Chip[] = [
      { id: 'game_type:catch', label: '接物游戏' },
      { id: 'game_type:dodge', label: '躲避游戏' },
    ];
    const warnings: ValidationIssue[] = [makeIssue('missing-input')];

    const result = appendWarningChips(existingChips, warnings);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('game_type:catch');
    expect(result[1].id).toBe('game_type:dodge');
    expect(result[2].id).toBe('add:TouchInput');
  });

  it('deduplicates: existing chip id wins, warning chip with same id is skipped', () => {
    const existingChips: Chip[] = [
      { id: 'add:TouchInput', label: '已有输入' },
    ];
    const warnings: ValidationIssue[] = [makeIssue('missing-input')];

    const result = appendWarningChips(existingChips, warnings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('add:TouchInput');
    expect(result[0].label).toBe('已有输入');
  });

  it('leaves existing chips unchanged when no warnings', () => {
    const existingChips: Chip[] = [
      { id: 'game_type:catch', label: '接物游戏' },
    ];

    const result = appendWarningChips(existingChips, []);

    expect(result).toHaveLength(1);
    expect(result).toEqual(existingChips);
  });

  it('returns warning chips when no existing chips and warnings exist', () => {
    const warnings: ValidationIssue[] = [makeIssue('missing-input')];

    const result = appendWarningChips(null, warnings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('add:TouchInput');
  });

  it('returns warning chips when existing chips is undefined and warnings exist', () => {
    const warnings: ValidationIssue[] = [makeIssue('event-chain-break')];

    const result = appendWarningChips(undefined, warnings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fix:event-chain');
  });

  it('caps appended warning chips at 2 (maxChips=2)', () => {
    const existingChips: Chip[] = [
      { id: 'game_type:catch', label: '接物游戏' },
    ];
    const warnings: ValidationIssue[] = [
      makeIssue('missing-input', 'pm_1'),
      makeIssue('event-chain-break', 'scorer_1'),
      makeIssue('invalid-param', 'spawner_1'),
    ];

    const result = appendWarningChips(existingChips, warnings);

    // 1 existing + at most 2 warning chips = 3
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('game_type:catch');
    expect(result[1].id).toBe('add:TouchInput');
    expect(result[2].id).toBe('fix:event-chain');
  });

  it('existing chips are not mutated', () => {
    const existingChips: Chip[] = [
      { id: 'game_type:catch', label: '接物游戏' },
    ];
    const originalLength = existingChips.length;
    const warnings: ValidationIssue[] = [makeIssue('missing-input')];

    appendWarningChips(existingChips, warnings);

    expect(existingChips).toHaveLength(originalLength);
  });

  it('returns empty array when no existing chips and no warnings', () => {
    const result = appendWarningChips(null, []);
    expect(result).toEqual([]);
  });

  it('only deduplicates by id — different ids always appended', () => {
    const existingChips: Chip[] = [
      { id: 'add:TouchInput', label: '添加输入模块' },
    ];
    const warnings: ValidationIssue[] = [
      makeIssue('event-chain-break', 'scorer_1'),
      makeIssue('module-conflict', 'timer_2'),
    ];

    const result = appendWarningChips(existingChips, warnings);

    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id);
    expect(ids).toContain('add:TouchInput');
    expect(ids).toContain('fix:event-chain');
    expect(ids).toContain('remove:timer_2');
  });
});
