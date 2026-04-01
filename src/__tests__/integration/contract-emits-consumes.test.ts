import { describe, it, expect } from 'vitest';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';
import { Scorer } from '@/engine/modules/mechanic/scorer';
import { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import { Projectile } from '@/engine/modules/mechanic/projectile';
import { Health } from '@/engine/modules/mechanic/health';

// ── Contract emits/consumes declarations ───────────────────────

describe('Contract emits/consumes — Spawner', () => {
  it('should declare spawner:created and spawner:destroyed in emits', () => {
    const spawner = new Spawner('s1', { items: [{ asset: 'a', weight: 1 }] });
    const contracts = spawner.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('spawner:created');
    expect(contracts.emits).toContain('spawner:destroyed');
  });

  it('should declare gameflow:resume in consumes', () => {
    const spawner = new Spawner('s1', { items: [{ asset: 'a', weight: 1 }] });
    const contracts = spawner.getContracts();
    expect(contracts.consumes).toBeDefined();
    expect(contracts.consumes).toContain('gameflow:resume');
  });
});

describe('Contract emits/consumes — PlayerMovement', () => {
  it('should declare player:move in emits', () => {
    const pm = new PlayerMovement('pm1', {});
    const contracts = pm.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('player:move');
  });

  it('should declare input events in consumes', () => {
    const pm = new PlayerMovement('pm1', {});
    const contracts = pm.getContracts();
    expect(contracts.consumes).toBeDefined();
    // Should consume at least one input event
    expect(contracts.consumes!.length).toBeGreaterThan(0);
  });
});

describe('Contract emits/consumes — Scorer', () => {
  it('should declare scorer:update in emits', () => {
    const scorer = new Scorer('sc1', { perHit: 10 });
    const contracts = scorer.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('scorer:update');
  });

  it('should declare its hitEvent in consumes', () => {
    const scorer = new Scorer('sc1', { perHit: 10 });
    const contracts = scorer.getContracts();
    expect(contracts.consumes).toBeDefined();
    expect(contracts.consumes).toContain('collision:hit');
  });

  it('should reflect custom hitEvent in consumes', () => {
    const scorer = new Scorer('sc1', { perHit: 10, hitEvent: 'beat:hit' });
    const contracts = scorer.getContracts();
    expect(contracts.consumes).toBeDefined();
    expect(contracts.consumes).toContain('beat:hit');
  });

  it('should declare scoring-core capability', () => {
    const scorer = new Scorer('sc1', { perHit: 10 });
    const contracts = scorer.getContracts();
    expect(contracts.capabilities).toBeDefined();
    expect(contracts.capabilities).toContain('scoring-core');
  });
});

describe('Contract emits/consumes — Projectile', () => {
  it('should declare projectile:fire and projectile:destroyed in emits', () => {
    const proj = new Projectile('p1', {});
    const contracts = proj.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('projectile:fire');
    expect(contracts.emits).toContain('projectile:destroyed');
  });

  it('should declare player:move and aim:update in consumes', () => {
    const proj = new Projectile('p1', {});
    const contracts = proj.getContracts();
    expect(contracts.consumes).toBeDefined();
    expect(contracts.consumes).toContain('player:move');
    expect(contracts.consumes).toContain('aim:update');
  });
});

describe('Contract emits/consumes — Health', () => {
  it('should declare health:change and health:zero in emits', () => {
    const health = new Health('h1', {});
    const contracts = health.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('health:change');
    expect(contracts.emits).toContain('health:zero');
  });

  it('should declare damage-receiver capability', () => {
    const health = new Health('h1', {});
    const contracts = health.getContracts();
    expect(contracts.capabilities).toBeDefined();
    expect(contracts.capabilities).toContain('damage-receiver');
  });
});

describe('Contract emits/consumes — Collision', () => {
  it('should declare collision:hit and collision:damage in emits', () => {
    const collision = new Collision('c1', { rules: [{ a: 'player', b: 'items', event: 'hit' }] });
    const contracts = collision.getContracts();
    expect(contracts.emits).toBeDefined();
    expect(contracts.emits).toContain('collision:hit');
    expect(contracts.emits).toContain('collision:damage');
  });
});
