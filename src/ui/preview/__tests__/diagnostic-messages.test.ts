import { describe, it, expect } from 'vitest';
import { translateIssue, getOverallStatus } from '../diagnostic-messages';
import type { ValidationIssue, ValidationReport } from '@/engine/core/config-validator';

function issue(
  category: ValidationIssue['category'],
  message: string,
  severity: 'error' | 'warning' = 'error',
): ValidationIssue {
  return { severity, category, moduleId: 'test_1', message };
}

function report(
  errors: ValidationIssue[] = [],
  warnings: ValidationIssue[] = [],
): ValidationReport {
  return { errors, warnings, fixes: [], isPlayable: errors.length === 0 };
}

// ── translateIssue ─────────────────────────────────────────────

describe('translateIssue', () => {
  it('should translate unknown-module to Chinese', () => {
    const result = translateIssue(issue('unknown-module', 'Unknown module type "FakeModule"'));
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(typeof result.title).toBe('string');
  });

  it('should translate missing-dependency', () => {
    const result = translateIssue(issue('missing-dependency', 'Module "Scorer" requires "Collision"'));
    expect(result.title).toBeTruthy();
    expect(result.description).toContain('Collision');
  });

  it('should translate empty-rules', () => {
    const result = translateIssue(issue('empty-rules', 'Collision module has no rules'));
    expect(result.title).toBeTruthy();
  });

  it('should translate event-chain-break', () => {
    const result = translateIssue(issue('event-chain-break', 'Scorer.hitEvent "nonexistent:event"'));
    expect(result.title).toBeTruthy();
  });

  it('should translate module-conflict', () => {
    const result = translateIssue(issue('module-conflict', 'Duplicate "PlayerMovement"', 'warning'));
    expect(result.title).toBeTruthy();
  });

  it('should translate missing-input', () => {
    const result = translateIssue(issue('missing-input', 'No input module', 'warning'));
    expect(result.title).toBeTruthy();
  });

  it('should translate invalid-param', () => {
    const result = translateIssue(issue('invalid-param', 'Spawner speed.min was -100', 'warning'));
    expect(result.title).toBeTruthy();
  });
});

// ── getOverallStatus ───────────────────────────────────────────

describe('getOverallStatus', () => {
  it('should return "ok" for clean report', () => {
    expect(getOverallStatus(report())).toBe('ok');
  });

  it('should return "error" when errors exist', () => {
    const r = report([issue('unknown-module', 'err')]);
    expect(getOverallStatus(r)).toBe('error');
  });

  it('should return "warning" when only warnings exist', () => {
    const r = report([], [issue('missing-input', 'warn', 'warning')]);
    expect(getOverallStatus(r)).toBe('warning');
  });

  it('should return "error" when both errors and warnings exist', () => {
    const r = report(
      [issue('unknown-module', 'err')],
      [issue('missing-input', 'warn', 'warning')],
    );
    expect(getOverallStatus(r)).toBe('error');
  });
});
