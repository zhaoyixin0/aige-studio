import { describe, it, expect } from 'vitest';
import { getGamePreset } from '@/agent/game-presets';

// ── Phase 3: Preset Quality Tests ──────────────────────────────
// Each test verifies that a game type's default preset meets
// industry-standard requirements for content quantity and variety.

describe('Platformer preset quality (H1)', () => {
  const preset = getGamePreset('platformer')!;

  it('should have 10+ platforms across multiple types', () => {
    const staticPlats = (preset['StaticPlatform'] as any)?.platforms ?? [];
    const movingPlats = (preset['MovingPlatform'] as any)?.platforms ?? [];
    const oneWayPlats = (preset['OneWayPlatform'] as any)?.platforms ?? [];
    const total = staticPlats.length + movingPlats.length + oneWayPlats.length;
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it('should include MovingPlatform module', () => {
    expect(preset['MovingPlatform']).toBeDefined();
  });

  it('should include OneWayPlatform module', () => {
    expect(preset['OneWayPlatform']).toBeDefined();
  });

  it('should have 6+ collectibles', () => {
    const items = (preset['Collectible'] as any)?.items ?? [];
    expect(items.length).toBeGreaterThanOrEqual(6);
  });

  it('should have 2+ hazard types', () => {
    const hazards = (preset['Hazard'] as any)?.hazards ?? [];
    expect(hazards.length).toBeGreaterThanOrEqual(2);
  });

  it('should have 2+ checkpoints', () => {
    const cps = (preset['Checkpoint'] as any)?.checkpoints ?? [];
    expect(cps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Shooting preset quality (H2)', () => {
  const preset = getGamePreset('shooting')!;

  it('should have maxEnemiesPerWave cap in WaveSpawner', () => {
    const ws = preset['WaveSpawner'] as any;
    expect(ws.maxEnemiesPerWave).toBeDefined();
    expect(ws.maxEnemiesPerWave).toBeLessThanOrEqual(15);
  });
});

describe('Rhythm preset quality (H4)', () => {
  const preset = getGamePreset('rhythm')!;

  it('should have non-empty beats array', () => {
    const bm = preset['BeatMap'] as any;
    expect(bm.beats.length).toBeGreaterThan(0);
  });

  it('should have beats covering full duration', () => {
    const bm = preset['BeatMap'] as any;
    const timer = preset['Timer'] as any;
    const lastBeat = bm.beats[bm.beats.length - 1];
    // Last beat should be within 2s of timer duration (beats are ms numbers)
    expect(lastBeat).toBeGreaterThan((timer.duration - 2) * 1000);
  });
});

describe('Action-RPG preset quality (H5)', () => {
  const preset = getGamePreset('action-rpg')!;

  it('should have non-empty SkillTree skills', () => {
    const st = preset['SkillTree'] as any;
    expect(st.skills.length).toBeGreaterThanOrEqual(3);
  });

  it('should include EquipmentSlot module', () => {
    expect(preset['EquipmentSlot']).toBeDefined();
  });
});

describe('Catch preset quality (H6)', () => {
  const preset = getGamePreset('catch')!;

  it('should have both good and bad items in Spawner', () => {
    const items = (preset['Spawner'] as any)?.items ?? [];
    const hasGood = items.some((i: any) => i.asset.startsWith('good'));
    const hasBad = items.some((i: any) => i.asset.startsWith('bad'));
    expect(hasGood).toBe(true);
    expect(hasBad).toBe(true);
  });

  it('should have collision rules for both hit and damage', () => {
    const rules = (preset['Collision'] as any)?.rules ?? [];
    const hasHit = rules.some((r: any) => r.event === 'hit');
    const hasDamage = rules.some((r: any) => r.event === 'damage');
    expect(hasHit).toBe(true);
    expect(hasDamage).toBe(true);
  });
});

describe('Dodge preset quality (H6)', () => {
  const preset = getGamePreset('dodge')!;

  it('should have both good and bad items in Spawner', () => {
    const items = (preset['Spawner'] as any)?.items ?? [];
    const hasBad = items.some((i: any) => i.asset.startsWith('bad'));
    const hasGood = items.some((i: any) => i.asset.startsWith('good'));
    expect(hasBad).toBe(true);
    expect(hasGood).toBe(true);
  });

  it('should have collision rules for both hit and damage', () => {
    const rules = (preset['Collision'] as any)?.rules ?? [];
    const hasHit = rules.some((r: any) => r.event === 'hit');
    const hasDamage = rules.some((r: any) => r.event === 'damage');
    expect(hasHit).toBe(true);
    expect(hasDamage).toBe(true);
  });
});
