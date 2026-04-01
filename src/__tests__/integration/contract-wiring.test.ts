import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { AutoWirer } from '@/engine/core/auto-wirer';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';
import { Projectile } from '@/engine/modules/mechanic/projectile';
import { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';
import { EnemyAI } from '@/engine/modules/mechanic/enemy-ai';
import { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import { Health } from '@/engine/modules/mechanic/health';
import { Scorer } from '@/engine/modules/mechanic/scorer';
import { Lives } from '@/engine/modules/mechanic/lives';
import { getGamePreset } from '@/agent/game-presets';

function createEngineWithModules(
  moduleConfigs: Array<{ type: string; id: string; params: Record<string, unknown> }>,
  canvas = { width: 1080, height: 1920 },
): Engine {
  const engine = new Engine();
  engine.loadConfig({
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas,
    modules: [],
    assets: {},
  });

  // Manually instantiate modules from the known types
  const MODULE_MAP: Record<string, new (id: string, params: Record<string, unknown>) => any> = {
    Spawner, Collision, Projectile, WaveSpawner, EnemyAI,
    PlayerMovement, Health, Scorer, Lives,
  };

  for (const mc of moduleConfigs) {
    const Ctor = MODULE_MAP[mc.type];
    if (Ctor) {
      engine.addModule(new Ctor(mc.id, mc.params));
    }
  }

  AutoWirer.wire(engine);
  return engine;
}

// ── Catch/Dodge/Tap (Spawner-pattern) ──────────────────────────

describe('Contract Wiring — Catch game', () => {
  it('should register spawned items in collision and score on hit', () => {
    const engine = createEngineWithModules([
      { type: 'Spawner', id: 'spawner_1', params: { items: [{ asset: 'apple', weight: 1 }], spriteSize: 48 } },
      { type: 'Collision', id: 'collision_1', params: { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] } },
      { type: 'PlayerMovement', id: 'pm_1', params: { defaultY: 0.85 } },
      { type: 'Scorer', id: 'scorer_1', params: { perHit: 10 } },
    ]);

    const collision = engine.getModule('collision_1') as Collision;
    const registerSpy = vi.spyOn(collision, 'registerObject');

    // Spawn an item
    engine.eventBus.emit('spawner:created', { id: 'item-1', x: 500, y: 100 });
    expect(registerSpy).toHaveBeenCalledWith('item-1', 'items', expect.objectContaining({ x: 500, y: 100 }));

    // Score on hit
    const scorer = engine.getModule('scorer_1') as unknown as Scorer;
    engine.eventBus.emit('collision:hit', { targetId: 'item-1' });
    expect(scorer.getScore()).toBe(10);
  });
});

describe('Contract Wiring — Dodge game', () => {
  it('should register spawned items and damage on collision', () => {
    const engine = createEngineWithModules([
      { type: 'Spawner', id: 'spawner_1', params: { items: [{ asset: 'bomb', weight: 1 }], spriteSize: 48 } },
      { type: 'Collision', id: 'collision_1', params: { rules: [{ a: 'player', b: 'items', event: 'damage' }] } },
      { type: 'PlayerMovement', id: 'pm_1', params: { defaultY: 0.85 } },
      { type: 'Lives', id: 'lives_1', params: { count: 3 } },
    ]);

    const collision = engine.getModule('collision_1') as Collision;
    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('spawner:created', { id: 'bomb-1', x: 300, y: 50 });
    expect(registerSpy).toHaveBeenCalledWith('bomb-1', 'items', expect.objectContaining({ x: 300, y: 50 }));
  });
});

// ── Shooting game ─────────────────────────────────────────────

describe('Contract Wiring — Shooting game (real preset)', () => {
  it('should load shooting preset modules', () => {
    const preset = getGamePreset('shooting');
    expect(preset).toBeDefined();
    expect(preset!['Projectile']).toBeDefined();
    expect(preset!['EnemyAI']).toBeDefined();
    expect(preset!['WaveSpawner']).toBeDefined();
    expect(preset!['PlayerMovement']).toBeDefined();
    expect(preset!['Health']).toBeDefined();
  });

  it('should wire bullet→enemy damage chain', () => {
    const preset = getGamePreset('shooting')!;
    const engine = createEngineWithModules([
      { type: 'PlayerMovement', id: 'pm_1', params: preset['PlayerMovement'] as Record<string, unknown> },
      { type: 'Projectile', id: 'proj_1', params: preset['Projectile'] as Record<string, unknown> },
      { type: 'EnemyAI', id: 'ai_1', params: preset['EnemyAI'] as Record<string, unknown> },
      { type: 'Health', id: 'health_1', params: preset['Health'] as Record<string, unknown> },
      { type: 'WaveSpawner', id: 'ws_1', params: preset['WaveSpawner'] as Record<string, unknown> },
      { type: 'Collision', id: 'collision_1', params: preset['Collision'] as Record<string, unknown> },
      { type: 'Scorer', id: 'scorer_1', params: preset['Scorer'] as Record<string, unknown> },
      { type: 'Lives', id: 'lives_1', params: preset['Lives'] as Record<string, unknown> },
    ]);

    const enemyAI = engine.getModule('ai_1') as unknown as EnemyAI;
    const health = engine.getModule('health_1') as Health;

    health.registerEntity('player_1');

    // Spawn enemy
    engine.eventBus.emit('wave:spawn', { id: 'e1', x: 540, y: 200 });
    expect(enemyAI.getActiveEnemies()).toHaveLength(1);

    // Bullet hits enemy (collision:hit) → enemy takes damage
    engine.eventBus.emit('collision:hit', {
      objectA: 'proj-1', objectB: 'e1',
      layerA: 'projectiles', layerB: 'enemies',
      targetId: 'e1', x: 540, y: 200,
    });

    // Enemy HP was 30, projectile damage is 10 → 20 remaining
    const enemy = enemyAI.getEnemy('e1');
    expect(enemy!.hp).toBe(20);
  });

  it('should wire enemy→player damage chain', () => {
    const preset = getGamePreset('shooting')!;
    const engine = createEngineWithModules([
      { type: 'PlayerMovement', id: 'pm_1', params: preset['PlayerMovement'] as Record<string, unknown> },
      { type: 'EnemyAI', id: 'ai_1', params: preset['EnemyAI'] as Record<string, unknown> },
      { type: 'Health', id: 'health_1', params: preset['Health'] as Record<string, unknown> },
      { type: 'Collision', id: 'collision_1', params: preset['Collision'] as Record<string, unknown> },
      { type: 'Lives', id: 'lives_1', params: preset['Lives'] as Record<string, unknown> },
    ]);

    const health = engine.getModule('health_1') as Health;
    health.registerEntity('player_1');

    // Enemy damages player (collision:damage)
    engine.eventBus.emit('collision:damage', {
      objectA: 'player_1', objectB: 'enemy-1',
      layerA: 'player', layerB: 'enemies',
      targetId: 'enemy-1', x: 540, y: 1600,
    });

    // Health was 100, enemy attackDamage is 10 → 90 remaining
    expect(health.getEntity('player_1')!.hp).toBe(90);
  });

  it('should use follow mode for player in shooting preset', () => {
    const preset = getGamePreset('shooting')!;
    expect(preset['PlayerMovement']).toEqual(
      expect.objectContaining({ mode: 'follow', followSpeed: 0.15 }),
    );
  });
});

// ── Action-RPG game ───────────────────────────────────────────

describe('Contract Wiring — Action-RPG game (real preset)', () => {
  it('should wire bullet→enemy and enemy→player damage', () => {
    const preset = getGamePreset('action-rpg')!;
    const engine = createEngineWithModules([
      { type: 'PlayerMovement', id: 'pm_1', params: preset['PlayerMovement'] as Record<string, unknown> },
      { type: 'Projectile', id: 'proj_1', params: preset['Projectile'] as Record<string, unknown> },
      { type: 'EnemyAI', id: 'ai_1', params: preset['EnemyAI'] as Record<string, unknown> },
      { type: 'Health', id: 'health_1', params: preset['Health'] as Record<string, unknown> },
      { type: 'WaveSpawner', id: 'ws_1', params: preset['WaveSpawner'] as Record<string, unknown> },
      { type: 'Collision', id: 'collision_1', params: preset['Collision'] as Record<string, unknown> },
    ]);

    const enemyAI = engine.getModule('ai_1') as unknown as EnemyAI;
    const health = engine.getModule('health_1') as Health;
    health.registerEntity('player_1');

    // Spawn and damage enemy
    engine.eventBus.emit('wave:spawn', { id: 'e1', x: 300, y: 300 });

    engine.eventBus.emit('collision:hit', {
      objectA: 'proj-1', objectB: 'e1',
      layerA: 'projectiles', layerB: 'enemies',
      targetId: 'e1', x: 300, y: 300,
    });

    // Enemy HP was 50, projectile damage is 15 → 35 remaining
    expect(enemyAI.getEnemy('e1')!.hp).toBe(35);

    // Enemy damages player
    engine.eventBus.emit('collision:damage', {
      objectA: 'player_1', objectB: 'e1',
      layerA: 'player', layerB: 'enemies',
      targetId: 'e1', x: 300, y: 300,
    });

    // Health was 100, enemy attackDamage is 10 → 90
    expect(health.getEntity('player_1')!.hp).toBe(90);
  });

  it('should use follow mode for player in action-rpg preset', () => {
    const preset = getGamePreset('action-rpg')!;
    expect(preset['PlayerMovement']).toEqual(
      expect.objectContaining({ mode: 'follow', followSpeed: 0.15 }),
    );
  });
});

// ── Preset quality: control configs ──────────────────────────

describe('Preset Quality — Control Configs', () => {
  it('shooting preset should have continuousEvent for face input', () => {
    const preset = getGamePreset('shooting')!;
    const pm = preset['PlayerMovement'] as Record<string, unknown>;
    expect(pm.continuousEvent).toBe('input:face:move');
  });

  it('action-rpg preset should have continuousEvent for face input', () => {
    const preset = getGamePreset('action-rpg')!;
    const pm = preset['PlayerMovement'] as Record<string, unknown>;
    expect(pm.continuousEvent).toBe('input:face:move');
  });

  it('platformer preset should NOT use swipe events for movement', () => {
    const preset = getGamePreset('platformer')!;
    const pm = preset['PlayerMovement'] as Record<string, unknown>;
    // Swipe is discrete, not suitable for continuous platformer movement
    // Hold-based input (built into PlayerMovement) handles left/right
    expect(pm.moveLeftEvent).toBeUndefined();
    expect(pm.moveRightEvent).toBeUndefined();
  });
});

// ── Runner game ───────────────────────────────────────────────

describe('Contract Wiring — Runner game', () => {
  it('should register runner items in collision', () => {
    const preset = getGamePreset('runner')!;

    const engine = createEngineWithModules([
      { type: 'Spawner', id: 'spawner_1', params: preset['Spawner'] as Record<string, unknown> },
      { type: 'Collision', id: 'collision_1', params: preset['Collision'] as Record<string, unknown> },
      { type: 'PlayerMovement', id: 'pm_1', params: preset['PlayerMovement'] as Record<string, unknown> },
    ]);

    const collision = engine.getModule('collision_1') as Collision;
    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('spawner:created', { id: 'coin-1', x: 200, y: 100 });
    expect(registerSpy).toHaveBeenCalledWith('coin-1', expect.any(String), expect.any(Object));
  });
});

// ── Cross-cutting: health:zero → lives:zero bridge ────────────

describe('Contract Wiring — health:zero → lives:zero bridge', () => {
  it('should emit lives:zero when player HP reaches 0', () => {
    const engine = createEngineWithModules([
      { type: 'Health', id: 'health_1', params: { maxHp: 10 } },
      { type: 'Collision', id: 'collision_1', params: { rules: [] } },
    ]);

    const health = engine.getModule('health_1') as Health;
    health.registerEntity('player_1');

    const livesZeroHandler = vi.fn();
    engine.eventBus.on('lives:zero', livesZeroHandler);

    health.damage('player_1', 10);
    expect(livesZeroHandler).toHaveBeenCalled();
  });
});

// ── Player registration in collision ──────────────────────────

describe('Contract Wiring — Player in Collision', () => {
  it('should register player_1 in collision player layer', () => {
    const engine = createEngineWithModules([
      { type: 'PlayerMovement', id: 'pm_1', params: { defaultY: 0.85 } },
      { type: 'Collision', id: 'collision_1', params: { rules: [] } },
    ]);

    const collision = engine.getModule('collision_1') as Collision;

    // Player should be synced via pre-update hook
    const updateSpy = vi.spyOn(collision, 'updateObject');
    engine.eventBus.emit('gameflow:resume');
    collision.update(16);

    expect(updateSpy).toHaveBeenCalledWith('player_1', expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }));
  });
});
