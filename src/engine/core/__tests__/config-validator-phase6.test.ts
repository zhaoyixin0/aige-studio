import { describe, it, expect } from 'vitest';
import { validateConfig } from '../config-validator';
import { ContractRegistry } from '../contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig, ModuleConfig } from '../types';

// ── Helpers ──────────────────────────────────────────────────

function makeConfig(modules: ModuleConfig[]): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

function mod(type: string, params: Record<string, unknown> = {}): ModuleConfig {
  return { id: `${type.toLowerCase()}_1`, type, enabled: true, params };
}

const registry = createModuleRegistry();
const contracts = ContractRegistry.fromRegistry(registry);

// ═══════════════════════════════════════════════════════════════
// Phase 6: validateConfig accepts ContractRegistry
// ═══════════════════════════════════════════════════════════════

describe('validateConfig with ContractRegistry parameter', () => {
  it('should accept ContractRegistry as second parameter', () => {
    const config = makeConfig([mod('Spawner'), mod('TouchInput')]);
    // This must not throw — validateConfig accepts ContractRegistry
    const report = validateConfig(config, contracts);
    expect(report).toBeDefined();
    expect(report.isPlayable).toBeDefined();
  });

  it('should detect unknown modules via ContractRegistry', () => {
    const config = makeConfig([mod('NonExistentModule')]);
    const report = validateConfig(config, contracts);
    const unknowns = report.errors.filter(e => e.category === 'unknown-module');
    expect(unknowns).toHaveLength(1);
    expect(unknowns[0].message).toContain('NonExistentModule');
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 6: Event Fulfillment (replaces MODULE_DEPENDENCIES)
// ═══════════════════════════════════════════════════════════════

describe('Event Fulfillment validation', () => {
  it('should warn when a module consumes an event that no enabled module emits', () => {
    // Scorer consumes collision:hit by default, but no Collision module present
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
    ]);
    const report = validateConfig(config, contracts);
    const fulfillmentWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break',
    );
    expect(fulfillmentWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT warn for universal events (gameflow:resume/pause)', () => {
    // Timer consumes gameflow:resume/pause via BaseModule, but these are universal
    const config = makeConfig([mod('Timer', { duration: 30 })]);
    const report = validateConfig(config, contracts);
    const fulfillmentWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break' && w.message.includes('gameflow:'),
    );
    expect(fulfillmentWarnings).toHaveLength(0);
  });

  it('should NOT warn when consumed event is emitted by another enabled module', () => {
    // Scorer consumes collision:hit, Collision emits collision:hit
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);
    const report = validateConfig(config, contracts);
    const fulfillmentWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break' && w.message.includes('collision:hit'),
    );
    expect(fulfillmentWarnings).toHaveLength(0);
  });

  it('should NOT check consumes for disabled modules', () => {
    const config = makeConfig([
      { id: 'scorer_1', type: 'Scorer', enabled: false, params: { hitEvent: 'nonexistent:event' } },
    ]);
    const report = validateConfig(config, contracts);
    const fulfillmentWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break',
    );
    expect(fulfillmentWarnings).toHaveLength(0);
  });

  it('disabled modules should NOT contribute to the emits pool', () => {
    // Collision is disabled — its emits should not satisfy Scorer's consumes
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
      { id: 'collision_1', type: 'Collision', enabled: false, params: { rules: [{ a: 'a', b: 'b', event: 'hit' }] } },
    ]);
    const report = validateConfig(config, contracts);
    // Scorer's collision:hit should be unfulfilled (Collision disabled)
    const chainErrors = report.errors.filter(
      e => e.category === 'event-chain-break',
    );
    expect(chainErrors.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 6: Scorer hitEvent — dynamic emits pool (replaces SCORER_VALID_HIT_EVENTS)
// ═══════════════════════════════════════════════════════════════

describe('Scorer hitEvent dynamic validation', () => {
  it('should error when Scorer.hitEvent is not emitted by any enabled module', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'nonexistent:event', perHit: 10 }),
    ]);
    const report = validateConfig(config, contracts);
    const chainErrors = report.errors.filter(e => e.category === 'event-chain-break');
    expect(chainErrors).toHaveLength(1);
    expect(chainErrors[0].message).toContain('nonexistent:event');
  });

  it('should pass when Scorer.hitEvent matches an emitted event', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collision:hit', perHit: 10 }),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);
    const report = validateConfig(config, contracts);
    expect(report.errors.filter(e => e.category === 'event-chain-break')).toHaveLength(0);
  });

  it('should accept beat:hit when BeatMap is present', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'beat:hit', perHit: 10 }),
      mod('BeatMap'),
    ]);
    const report = validateConfig(config, contracts);
    expect(report.errors.filter(e => e.category === 'event-chain-break')).toHaveLength(0);
  });

  it('should accept collectible:pickup when Collectible is present', () => {
    const config = makeConfig([
      mod('Scorer', { hitEvent: 'collectible:pickup', perHit: 10 }),
      mod('Collectible'),
      mod('Collision', { rules: [{ a: 'player', b: 'items', event: 'hit' }] }),
    ]);
    const report = validateConfig(config, contracts);
    expect(report.errors.filter(e => e.category === 'event-chain-break')).toHaveLength(0);
  });

  it('should error when Scorer uses default collision:hit but no Collision module', () => {
    const config = makeConfig([
      mod('Scorer', { perHit: 10 }), // default hitEvent = collision:hit
    ]);
    const report = validateConfig(config, contracts);
    const chainErrors = report.errors.filter(e => e.category === 'event-chain-break');
    expect(chainErrors.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Wildcard consumes matching
// ═══════════════════════════════════════════════════════════════

describe('Wildcard consumes matching', () => {
  it('should NOT warn when wildcard consumes is satisfied by a matching emitter', () => {
    // BeatMap consumes input:face:*, FaceInput emits input:face:move etc.
    const config = makeConfig([
      mod('BeatMap'),
      mod('FaceInput'),
    ]);
    const report = validateConfig(config, contracts);
    const wildcardWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break' && w.message.includes('input:face:*'),
    );
    expect(wildcardWarnings).toHaveLength(0);
  });

  it('should warn when wildcard consumes has no matching emitter', () => {
    // BeatMap consumes input:face:*, but no FaceInput present
    const config = makeConfig([
      mod('BeatMap'),
      mod('TouchInput'),
    ]);
    const report = validateConfig(config, contracts);
    const wildcardWarnings = report.warnings.filter(
      w => w.category === 'event-chain-break' && w.message.includes('input:face:*'),
    );
    expect(wildcardWarnings).toHaveLength(1);
  });
});
