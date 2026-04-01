import { describe, it, expect } from 'vitest';
import { validateConfig } from '../config-validator';
import { ContractRegistry } from '../contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig } from '../types';

function makeConfig(modules: Array<{ type: string; params?: Record<string, any> }>): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 800, height: 600 },
    modules: modules.map((m, i) => ({
      id: `${m.type.toLowerCase()}-${i}`,
      type: m.type,
      enabled: true,
      params: m.params ?? {},
    })),
    assets: {},
  };
}

describe('ConfigValidator with ContractRegistry', () => {
  const registry = createModuleRegistry();
  const contractRegistry = ContractRegistry.fromRegistry(registry);

  it('should accept known modules when using ContractRegistry', () => {
    const config = makeConfig([
      { type: 'TouchInput' },
      { type: 'Spawner', params: { spriteSize: 64 } },
      { type: 'Collision', params: { rules: [{ a: 'player', b: 'items', event: 'hit' }] } },
      { type: 'Scorer', params: { hitEvent: 'collision:hit' } },
      { type: 'Timer', params: { duration: 30 } },
      { type: 'GameFlow' },
    ]);

    const report = validateConfig(config, contractRegistry);
    const unknownErrors = report.errors.filter((e) => e.category === 'unknown-module');
    expect(unknownErrors).toHaveLength(0);
  });

  it('should reject unknown modules when using ContractRegistry', () => {
    const config = makeConfig([{ type: 'FakeModule' }]);
    const report = validateConfig(config, contractRegistry);
    const unknownErrors = report.errors.filter((e) => e.category === 'unknown-module');
    expect(unknownErrors).toHaveLength(1);
    expect(unknownErrors[0].message).toContain('FakeModule');
  });

  it('ContractRegistry should cover all expected module types', () => {
    const registryTypes = contractRegistry.getKnownTypes();
    // Spot-check key modules from each category
    expect(registryTypes.has('Spawner')).toBe(true);
    expect(registryTypes.has('Collision')).toBe(true);
    expect(registryTypes.has('TouchInput')).toBe(true);
    expect(registryTypes.has('GameFlow')).toBe(true);
    expect(registryTypes.has('Gravity')).toBe(true);
    expect(registryTypes.has('Health')).toBe(true);
    expect(registryTypes.has('SkillTree')).toBe(true);
    expect(registryTypes.has('EnemyAI')).toBe(true);
  });

  it('getAllEmittedEvents should include scorer-valid hit events', () => {
    const allEmits = contractRegistry.getAllEmittedEvents();
    expect(allEmits.has('collision:hit')).toBe(true);
    expect(allEmits.has('collision:damage')).toBe(true);
    expect(allEmits.has('scorer:update')).toBe(true);
  });
});
