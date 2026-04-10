import { describe, it, expect, beforeAll } from 'vitest';
import { PresetRegistry } from '../preset-registry';
import type { PresetTemplate } from '../types';

// Load hero presets via import.meta.glob. Skeleton presets (kind:'hero-skeleton')
// are the new v2 declarative format — they do NOT have a sequence and are
// routed through the hero-skeleton-builder, not RecipeExecutor.
//
// As of P5-A, all hero presets have been migrated to hero-skeleton v2, so this
// file now asserts the "no legacy hero presets remain" invariant and leaves the
// RecipeExecutor coverage to expert-registry.test.ts.
const presetFiles = import.meta.glob('/src/knowledge/recipes-runner/*.preset.json', {
  eager: true,
  import: 'default',
});

const heroPresets: PresetTemplate[] = (Object.values(presetFiles) as unknown[])
  .filter((v): v is PresetTemplate => {
    if (typeof v !== 'object' || v === null) return false;
    return (v as Record<string, unknown>).kind !== 'hero-skeleton';
  });

describe('Hero Recipe Presets', () => {
  let registry: PresetRegistry;

  beforeAll(() => {
    registry = new PresetRegistry();
    registry.registerAll(heroPresets);
  });

  it('has zero legacy hero presets — all migrated to hero-skeleton v2', () => {
    expect(heroPresets.length).toBe(0);
    expect(registry.size()).toBe(0);
  });

  it('findByGameType returns empty for every game type (no legacy heroes)', () => {
    expect(registry.findByGameType('platformer').length).toBe(0);
    expect(registry.findByGameType('shooting').length).toBe(0);
    expect(registry.findByGameType('catch').length).toBe(0);
  });

  it('search returns empty (no legacy heroes)', () => {
    expect(registry.search('shooter').length).toBe(0);
    expect(registry.search('platformer').length).toBe(0);
  });
});
