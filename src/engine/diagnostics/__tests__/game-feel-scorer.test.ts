import { describe, it, expect } from 'vitest';
import type { GameConfig } from '@/engine/core';
import { computeFeelScore } from '../game-feel-scorer';

function makeConfig(modTypes: string[]): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: 'test',
      description: '',
      thumbnail: null,
      createdAt: '2026-01-01',
      theme: 'fruit',
      artStyle: 'cartoon',
    },
    canvas: { width: 1080, height: 1920 },
    modules: modTypes.map((t, i) => ({
      id: `${t.toLowerCase()}_${i}`,
      type: t,
      enabled: true,
      params: {},
    })),
    assets: {},
  } as GameConfig;
}

describe('game-feel-scorer (runtime)', () => {
  it('empty config → low score, badge null', () => {
    const r = computeFeelScore(makeConfig([]));
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThan(40);
    expect(r.badge).toBeNull();
    expect(Object.keys(r.dimensions)).toHaveLength(8);
  });

  it('rich config (10+ modules incl. physics & feedback) → score > 60', () => {
    const r = computeFeelScore(
      makeConfig([
        'GameFlow', 'Spawner', 'Collision', 'Scorer', 'Timer',
        'ParticleVFX', 'SoundFX', 'UIOverlay', 'DifficultyRamp',
        'Gravity', 'Jump',
      ]),
    );
    expect(r.total).toBeGreaterThan(60);
    expect(['silver', 'gold', 'expert']).toContain(r.badge);
  });

  it('badge thresholds are monotonically increasing with modules', () => {
    const small = computeFeelScore(makeConfig(['GameFlow', 'Timer']));
    const medium = computeFeelScore(
      makeConfig(['GameFlow', 'Timer', 'UIOverlay', 'Scorer', 'Collision', 'ParticleVFX', 'SoundFX']),
    );
    const large = computeFeelScore(
      makeConfig([
        'GameFlow', 'Timer', 'UIOverlay', 'Scorer', 'Collision',
        'ParticleVFX', 'SoundFX', 'DifficultyRamp', 'Gravity', 'Jump', 'CameraFollow',
      ]),
    );
    expect(small.total).toBeLessThan(medium.total);
    expect(medium.total).toBeLessThan(large.total);
  });

  it('determinism: same config → same score', () => {
    const cfg = makeConfig(['GameFlow', 'Timer', 'UIOverlay']);
    const r1 = computeFeelScore(cfg);
    const r2 = computeFeelScore(cfg);
    expect(r1.total).toBe(r2.total);
    expect(r1.badge).toBe(r2.badge);
    expect(r1.dimensions).toEqual(r2.dimensions);
    expect(r1.suggestions.map((s) => s.id).sort()).toEqual(
      r2.suggestions.map((s) => s.id).sort(),
    );
  });

  it('suggests missing feedback and ramp modules', () => {
    const r = computeFeelScore(makeConfig(['GameFlow', 'Timer']));
    const ids = r.suggestions.map((s) => s.id);
    expect(ids).toContain('add-vfx');
    expect(ids).toContain('add-sfx');
    expect(ids).toContain('add-ramp');
    expect(ids).toContain('add-ui');
  });

  it('does not suggest modules already present', () => {
    const r = computeFeelScore(
      makeConfig(['ParticleVFX', 'SoundFX', 'DifficultyRamp', 'UIOverlay']),
    );
    const ids = r.suggestions.map((s) => s.id);
    expect(ids).not.toContain('add-vfx');
    expect(ids).not.toContain('add-sfx');
    expect(ids).not.toContain('add-ramp');
    expect(ids).not.toContain('add-ui');
  });
});
