import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  type ValidationReport,
  type ValidationIssue,
} from '@/engine/core/config-validator';
import type { GameConfig, ModuleConfig } from '@/engine/core/types';
import { getGamePreset, ALL_GAME_TYPES } from '@/agent/game-presets';

// ── Helpers ────────────────────────────────────────────────────

function makeConfig(modules: ModuleConfig[], overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
    ...overrides,
  };
}

function mod(type: string, params: Record<string, unknown> = {}): ModuleConfig {
  return { id: `${type.toLowerCase()}_1`, type, enabled: true, params };
}

function errorsByCategory(report: ValidationReport, category: string): readonly ValidationIssue[] {
  return report.errors.filter((e) => e.category === category);
}

function warningsByCategory(report: ValidationReport, category: string): readonly ValidationIssue[] {
  return report.warnings.filter((w) => w.category === category);
}

// ── 1. Unknown Module Types ────────────────────────────────────

describe('ConfigValidator — unknown modules', () => {
  it('should error on unknown module types', () => {
    const config = makeConfig([
      mod('FakeModule'),
      mod('Spawner'),
    ]);

    const report = validateConfig(config);

    const unknowns = errorsByCategory(report, 'unknown-module');
    expect(unknowns).toHaveLength(1);
    expect(unknowns[0].moduleId).toBe('fakemodule_1');
    expect(report.isPlayable).toBe(false);
  });

  it('should pass config with only known modules', () => {
    const config = makeConfig([
      mod('Spawner', { frequency: 1 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
      mod('Scorer', { perHit: 10 }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'unknown-module')).toHaveLength(0);
  });

  it('should skip disabled modules', () => {
    const config = makeConfig([
      { id: 'fake_1', type: 'FakeModule', enabled: false, params: {} },
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'unknown-module')).toHaveLength(0);
    expect(report.isPlayable).toBe(true);
  });
});

// ── 2. Missing Dependencies ───────────────────────────────────

describe('ConfigValidator — missing dependencies', () => {
  it('should error when Scorer is present without Collision', () => {
    const config = makeConfig([
      mod('Scorer', { perHit: 10 }),
      mod('Timer'),
    ]);

    const report = validateConfig(config);

    const missing = errorsByCategory(report, 'missing-dependency');
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing[0].message).toContain('Collision');
    expect(report.isPlayable).toBe(false);
  });

  it('should pass when all required dependencies are present', () => {
    const config = makeConfig([
      mod('Scorer', { perHit: 10 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'missing-dependency')).toHaveLength(0);
  });

  it('should error when Dash is present without PlayerMovement', () => {
    const config = makeConfig([
      mod('Dash'),
    ]);

    const report = validateConfig(config);

    const missing = errorsByCategory(report, 'missing-dependency');
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing[0].message).toContain('PlayerMovement');
  });

  it('should not error on optional dependencies', () => {
    const config = makeConfig([
      mod('Jump'),  // optional: Gravity
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'missing-dependency')).toHaveLength(0);
  });
});

// ── 3. Empty Collision Rules ──────────────────────────────────

describe('ConfigValidator — empty collision rules', () => {
  it('should error when Collision module has empty rules array', () => {
    const config = makeConfig([
      mod('Collision', { rules: [] }),
    ]);

    const report = validateConfig(config);

    const emptyRules = errorsByCategory(report, 'empty-rules');
    expect(emptyRules).toHaveLength(1);
    expect(report.isPlayable).toBe(false);
  });

  it('should error when Collision module has no rules param', () => {
    const config = makeConfig([
      mod('Collision', {}),
    ]);

    const report = validateConfig(config);

    const emptyRules = errorsByCategory(report, 'empty-rules');
    expect(emptyRules).toHaveLength(1);
  });

  it('should pass when Collision has valid rules', () => {
    const config = makeConfig([
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'empty-rules')).toHaveLength(0);
  });
});

// ── 4. Invalid Parameters (Schema Validation) ─────────────────

describe('ConfigValidator — invalid parameters', () => {
  it('should warn and auto-fix negative Spawner speed', () => {
    const config = makeConfig([
      mod('Spawner', { speed: { min: -100, max: 200 }, frequency: 1 }),
    ]);

    const report = validateConfig(config);

    const fixes = report.fixes.filter((f) => f.moduleId === 'spawner_1');
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    // min speed should be clamped to 0
    const speedFix = fixes.find((f) => f.param === 'speed.min');
    expect(speedFix).toBeDefined();
    expect(speedFix!.from).toBe(-100);
    expect(speedFix!.to).toBe(0);
  });

  it('should warn and auto-fix inverted speed range (min > max)', () => {
    const config = makeConfig([
      mod('Spawner', { speed: { min: 500, max: 100 }, frequency: 1 }),
    ]);

    const report = validateConfig(config);

    const fixes = report.fixes.filter((f) => f.moduleId === 'spawner_1');
    expect(fixes.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn and auto-fix negative Timer duration', () => {
    const config = makeConfig([
      mod('Timer', { duration: -10, mode: 'countdown' }),
    ]);

    const report = validateConfig(config);

    const fixes = report.fixes.filter((f) => f.moduleId === 'timer_1');
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    const durationFix = fixes.find((f) => f.param === 'duration');
    expect(durationFix).toBeDefined();
    expect(durationFix!.to).toBeGreaterThan(0);
  });

  it('should warn and auto-fix zero Lives count', () => {
    const config = makeConfig([
      mod('Lives', { count: 0 }),
    ]);

    const report = validateConfig(config);

    const fixes = report.fixes.filter((f) => f.moduleId === 'lives_1');
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    const countFix = fixes.find((f) => f.param === 'count');
    expect(countFix).toBeDefined();
    expect(countFix!.to).toBeGreaterThanOrEqual(1);
  });
});

// ── 5. Event Chain Breaks (Scorer.hitEvent) ────────────────────

describe('ConfigValidator — event chain breaks', () => {
  it('should error when Scorer.hitEvent references non-existent event', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'nonexistent:event', perHit: 10 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);

    const chainBreaks = errorsByCategory(report, 'event-chain-break');
    expect(chainBreaks).toHaveLength(1);
    expect(chainBreaks[0].message).toContain('nonexistent:event');
  });

  it('should pass when Scorer.hitEvent matches a valid event', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'event-chain-break')).toHaveLength(0);
  });

  it('should pass when Scorer uses default hitEvent (collision:hit) with Collision present', () => {
    const config = makeConfig([
      mod('Scorer', { perHit: 10 }),  // default hitEvent = 'collision:hit'
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'event-chain-break')).toHaveLength(0);
  });

  it('should error when Scorer uses collision:hit but no Collision module exists', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
      // No Collision module!
    ]);

    const report = validateConfig(config);
    // Should have either event-chain-break or missing-dependency
    const issues = [
      ...errorsByCategory(report, 'event-chain-break'),
      ...errorsByCategory(report, 'missing-dependency'),
    ];
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('should accept beat:hit for rhythm games', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'beat:hit', perHit: 10 }),
      mod('BeatMap'),
      mod('Collision', { rules: [{ a: 'a', b: 'b', event: 'hit' }] }),
    ]);

    const report = validateConfig(config);
    expect(errorsByCategory(report, 'event-chain-break')).toHaveLength(0);
  });
});

// ── 6. Module Conflicts ────────────────────────────────────────

describe('ConfigValidator — module conflicts', () => {
  it('should warn when multiple PlayerMovement modules exist', () => {
    const config = makeConfig([
      { id: 'pm_1', type: 'PlayerMovement', enabled: true, params: {} },
      { id: 'pm_2', type: 'PlayerMovement', enabled: true, params: {} },
    ]);

    const report = validateConfig(config);

    const conflicts = [
      ...errorsByCategory(report, 'module-conflict'),
      ...warningsByCategory(report, 'module-conflict'),
    ];
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn when multiple input modules of the same type exist', () => {
    const config = makeConfig([
      { id: 'touch_1', type: 'TouchInput', enabled: true, params: {} },
      { id: 'touch_2', type: 'TouchInput', enabled: true, params: {} },
    ]);

    const report = validateConfig(config);

    const conflicts = [
      ...errorsByCategory(report, 'module-conflict'),
      ...warningsByCategory(report, 'module-conflict'),
    ];
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 7. Missing Input Module ───────────────────────────────────

describe('ConfigValidator — missing input module', () => {
  it('should warn when PlayerMovement exists but no input module is present', () => {
    const config = makeConfig([
      mod('PlayerMovement', { mode: 'follow' }),
    ]);

    const report = validateConfig(config);

    const missingInput = warningsByCategory(report, 'missing-input');
    expect(missingInput.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass when PlayerMovement has an input module', () => {
    const config = makeConfig([
      mod('PlayerMovement', { mode: 'follow' }),
      mod('TouchInput'),
    ]);

    const report = validateConfig(config);
    expect(warningsByCategory(report, 'missing-input')).toHaveLength(0);
  });
});

// ── 8. All Presets Pass Validation ─────────────────────────────

describe('ConfigValidator — all game presets pass', () => {
  for (const gameType of ALL_GAME_TYPES) {
    it(`should produce no errors for "${gameType}" preset`, () => {
      const preset = getGamePreset(gameType)!;
      const modules: ModuleConfig[] = [];

      for (const [moduleType, params] of Object.entries(preset)) {
        const isInputModule = ['FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput'].includes(moduleType);
        if (isInputModule && moduleType !== 'TouchInput') continue;

        modules.push({
          id: `${moduleType.toLowerCase()}_1`,
          type: moduleType,
          enabled: true,
          params: { ...(params as Record<string, unknown>) },
        });
      }

      // Ensure at least TouchInput is present
      if (!modules.some((m) => m.type === 'TouchInput')) {
        modules.push(mod('TouchInput'));
      }

      // Ensure GameFlow is present (always needed)
      if (!modules.some((m) => m.type === 'GameFlow')) {
        modules.push(mod('GameFlow', { countdown: 3, onFinish: 'show_result' }));
      }

      const config = makeConfig(modules);
      const report = validateConfig(config);

      // No errors allowed for presets
      expect(report.errors).toHaveLength(0);
      expect(report.isPlayable).toBe(true);
    });
  }
});

// ── 9. ValidationReport structure ──────────────────────────────

describe('ConfigValidator — report structure', () => {
  it('should return correct ValidationReport shape', () => {
    const config = makeConfig([mod('Spawner')]);
    const report = validateConfig(config);

    expect(report).toHaveProperty('errors');
    expect(report).toHaveProperty('warnings');
    expect(report).toHaveProperty('fixes');
    expect(report).toHaveProperty('isPlayable');
    expect(Array.isArray(report.errors)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.fixes)).toBe(true);
    expect(typeof report.isPlayable).toBe('boolean');
  });

  it('should return isPlayable=true when no errors exist', () => {
    const config = makeConfig([
      mod('Spawner', { frequency: 1 }),
      mod('TouchInput'),
    ]);

    const report = validateConfig(config);
    expect(report.isPlayable).toBe(true);
  });
});
