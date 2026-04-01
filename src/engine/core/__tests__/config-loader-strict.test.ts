import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { ModuleRegistry } from '../module-registry';
import { ConfigLoader } from '../config-loader';
import type { GameConfig } from '../types';
import { createModuleRegistry } from '@/engine/module-setup';

function makeConfig(
  modules: Array<{ id: string; type: string; enabled?: boolean; params?: Record<string, any> }>,
): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: modules.map((m) => ({
      id: m.id,
      type: m.type,
      enabled: m.enabled ?? true,
      params: m.params ?? {},
    })),
    assets: {},
  };
}

// ── Strict Mode: Structural Errors ─────────────────────────────

describe('ConfigLoader — strict mode', () => {
  it('should throw on unknown module types in strict mode', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: true });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'fake_1', type: 'NonExistentModule' },
    ]);

    expect(() => loader.load(engine, config)).toThrow(/unknown module/i);
  });

  it('should NOT throw on unknown module types when strict=false', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: false });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'fake_1', type: 'NonExistentModule' },
    ]);

    // Should warn, not throw (legacy behavior)
    expect(() => loader.load(engine, config)).not.toThrow();
  });

  it('should throw when required dependency is missing in strict mode', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: true });
    const engine = new Engine();

    // Scorer requires Collision, but Collision is absent
    const config = makeConfig([
      { id: 'scorer_1', type: 'Scorer', params: { perHit: 10 } },
    ]);

    expect(() => loader.load(engine, config)).toThrow(/Collision/);
  });

  it('should throw when Collision has empty rules in strict mode', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: true });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'collision_1', type: 'Collision', params: { rules: [] } },
    ]);

    expect(() => loader.load(engine, config)).toThrow(/empty|rules/i);
  });

  it('should load valid config without errors in strict mode', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: true });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'spawner_1', type: 'Spawner', params: { frequency: 1, items: [{ asset: 'a', weight: 1 }] } },
      { id: 'collision_1', type: 'Collision', params: { rules: [{ a: 'player', b: 'items', event: 'hit' }] } },
      { id: 'scorer_1', type: 'Scorer', params: { perHit: 10 } },
      { id: 'timer_1', type: 'Timer', params: { duration: 30 } },
      { id: 'touch_1', type: 'TouchInput', params: {} },
    ]);

    expect(() => loader.load(engine, config)).not.toThrow();
    expect(engine.getModule('spawner_1')).toBeDefined();
    expect(engine.getModule('collision_1')).toBeDefined();
    expect(engine.getModule('scorer_1')).toBeDefined();
  });
});

// ── Validation Report Access ───────────────────────────────────

describe('ConfigLoader — validation report', () => {
  it('should expose last validation report after load', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: false });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'spawner_1', type: 'Spawner', params: { frequency: 1 } },
      { id: 'touch_1', type: 'TouchInput', params: {} },
    ]);

    loader.load(engine, config);

    const report = loader.getLastValidationReport();
    expect(report).not.toBeNull();
    expect(report!.isPlayable).toBe(true);
  });

  it('should report errors for invalid config', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: false });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'fake_1', type: 'FakeModule' },
    ]);

    loader.load(engine, config);

    const report = loader.getLastValidationReport();
    expect(report).not.toBeNull();
    expect(report!.errors.length).toBeGreaterThan(0);
    expect(report!.isPlayable).toBe(false);
  });

  it('should apply auto-fixes and include them in report', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry, { strict: false });
    const engine = new Engine();

    const config = makeConfig([
      { id: 'timer_1', type: 'Timer', params: { duration: -5, mode: 'countdown' } },
    ]);

    loader.load(engine, config);

    const report = loader.getLastValidationReport();
    expect(report).not.toBeNull();
    expect(report!.fixes.length).toBeGreaterThan(0);
    // Timer duration should have been auto-fixed
    const timerMod = engine.getModule('timer_1');
    expect(timerMod).toBeDefined();
  });
});

// ── Default strict=false for backwards compatibility ───────────

describe('ConfigLoader — backwards compatibility', () => {
  it('should default to strict=false (legacy behavior)', () => {
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry); // no options
    const engine = new Engine();

    const config = makeConfig([
      { id: 'fake_1', type: 'NonExistentModule' },
    ]);

    // Should not throw (legacy)
    expect(() => loader.load(engine, config)).not.toThrow();
  });
});
