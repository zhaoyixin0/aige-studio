// src/agent/__tests__/preset-advice.test.ts
//
// Unit tests for detectSignatureDrift — reads expert card signatureParams and
// flags config values that deviate > 50% from the expert-calibrated suggestion.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameConfig, ModuleConfig } from '@/engine/core/types';
import type { SkillLoader } from '../skill-loader';
import { detectSignatureDrift } from '../preset-advice';

interface StubCard {
  readonly signatureParams?: Record<
    string,
    { suggested: number; confidence: number }
  >;
}

function makeStubLoader(
  cardsByType: Record<string, StubCard | null>,
): SkillLoader {
  return {
    loadExpertCardRaw: vi.fn(async (gameType: string) => {
      return cardsByType[gameType] ?? null;
    }),
  } as unknown as SkillLoader;
}

function makeConfig(modules: ModuleConfig[]): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

function spawnerModule(params: Record<string, unknown>): ModuleConfig {
  return { id: 'spawner_1', type: 'Spawner', enabled: true, params };
}

function collisionModule(): ModuleConfig {
  return { id: 'collision_1', type: 'Collision', enabled: true, params: {} };
}

describe('detectSignatureDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] when expert card has no signatureParams', async () => {
    const loader = makeStubLoader({ catch: { signatureParams: {} } });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 2 })]),
      'catch',
      loader,
    );
    expect(advice).toEqual([]);
  });

  it('returns [] when expert card is missing', async () => {
    const loader = makeStubLoader({ catch: null });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 2 })]),
      'catch',
      loader,
    );
    expect(advice).toEqual([]);
  });

  it('skips params with confidence < 0.3', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1.3, confidence: 0.1 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 10 })]),
      'catch',
      loader,
    );
    expect(advice).toEqual([]);
  });

  it('flags module params that deviate > 50% from suggested', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1.3, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 2.8 })]),
      'catch',
      loader,
    );
    expect(advice).toHaveLength(1);
    const [entry] = advice;
    expect(entry.moduleType).toBe('Spawner');
    expect(entry.paramKey).toBe('frequency');
    expect(entry.actualValue).toBe(2.8);
    expect(entry.suggestedValue).toBe(1.3);
    expect(entry.level).toBe('warning');
    expect(entry.message).toContain('1.3');
    expect(entry.message).toContain('2.8');
  });

  it('assigns level=info for medium confidence (0.3..0.7)', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1, confidence: 0.5 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 3 })]),
      'catch',
      loader,
    );
    expect(advice).toHaveLength(1);
    expect(advice[0].level).toBe('info');
  });

  it('does not flag values within the 50% tolerance band', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 2, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 2.5 })]),
      'catch',
      loader,
    );
    expect(advice).toEqual([]);
  });

  it('ignores non-numeric module params', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1.3, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 'fast' })]),
      'catch',
      loader,
    );
    expect(advice).toEqual([]);
  });

  it('maps object_count to total renderable module count', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          object_count: { suggested: 10, confidence: 0.8 },
        },
      },
    });
    // Only 2 modules → well below suggested 10 (>50% drift)
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({}), collisionModule()]),
      'catch',
      loader,
    );
    expect(advice).toHaveLength(1);
    expect(advice[0].paramKey).toBe('object_count');
  });

  it('maps collider_count to modules with collision role', async () => {
    const loader = makeStubLoader({
      runner: {
        signatureParams: {
          collider_count: { suggested: 5, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([collisionModule()]),
      'runner',
      loader,
    );
    expect(advice.length).toBeGreaterThanOrEqual(0);
    // Exactly 1 collision module vs 5 suggested → should flag drift
    expect(advice).toHaveLength(1);
    expect(advice[0].paramKey).toBe('collider_count');
  });

  it('returns multiple advice entries for multiple drifting params', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1, confidence: 0.8 },
          speed: { suggested: 100, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 5, speed: 400 })]),
      'catch',
      loader,
    );
    expect(advice.length).toBeGreaterThanOrEqual(2);
    const keys = advice.map((a) => a.paramKey).sort();
    expect(keys).toEqual(['frequency', 'speed']);
  });

  it('limits output to 5 advice entries', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          p1: { suggested: 1, confidence: 0.8 },
          p2: { suggested: 1, confidence: 0.8 },
          p3: { suggested: 1, confidence: 0.8 },
          p4: { suggested: 1, confidence: 0.8 },
          p5: { suggested: 1, confidence: 0.8 },
          p6: { suggested: 1, confidence: 0.8 },
          p7: { suggested: 1, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([
        spawnerModule({
          p1: 10,
          p2: 10,
          p3: 10,
          p4: 10,
          p5: 10,
          p6: 10,
          p7: 10,
        }),
      ]),
      'catch',
      loader,
    );
    expect(advice).toHaveLength(5);
  });

  it('message contains suggested and actual numbers for warning level', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1.3, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 0.4 })]),
      'catch',
      loader,
    );
    expect(advice[0].message).toMatch(/1.3/);
    expect(advice[0].message).toMatch(/0.4/);
    expect(advice[0].message).toMatch(/偏低/);
  });

  it('message uses 偏高 marker when actual > suggested', async () => {
    const loader = makeStubLoader({
      catch: {
        signatureParams: {
          frequency: { suggested: 1, confidence: 0.8 },
        },
      },
    });
    const advice = await detectSignatureDrift(
      makeConfig([spawnerModule({ frequency: 5 })]),
      'catch',
      loader,
    );
    expect(advice[0].message).toMatch(/偏高/);
  });
});
