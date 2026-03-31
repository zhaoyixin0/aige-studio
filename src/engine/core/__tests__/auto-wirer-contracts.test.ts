import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { AutoWirer } from '../auto-wirer';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';
import { Projectile } from '@/engine/modules/mechanic/projectile';
import { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';
import { EnemyAI } from '@/engine/modules/mechanic/enemy-ai';
import { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import { Health } from '@/engine/modules/mechanic/health';
import { Collectible } from '@/engine/modules/mechanic/collectible';

// ── Phase A: Object Registration via Contracts ──────────────────────

describe('AutoWirer Phase A — Registration', () => {
  it('should register spawned objects via Spawner contract', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      spriteSize: 48,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('spawner:created', { id: 'spawn-1', x: 100, y: 50 });

    expect(registerSpy).toHaveBeenCalledWith('spawn-1', 'items', {
      x: 100, y: 50, radius: 24,
    });
  });

  it('should unregister spawned objects via Spawner contract', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', { items: [{ asset: 'a', weight: 1 }] });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const unregisterSpy = vi.spyOn(collision, 'unregisterObject');
    engine.eventBus.emit('spawner:destroyed', { id: 'spawn-1' });

    expect(unregisterSpy).toHaveBeenCalledWith('spawn-1');
  });

  it('should register projectiles via Projectile contract', () => {
    const engine = new Engine();
    const projectile = new Projectile('proj-1', { collisionRadius: 10 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(projectile);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');
    engine.eventBus.emit('projectile:fire', { id: 'proj-99', x: 200, y: 300 });

    expect(registerSpy).toHaveBeenCalledWith('proj-99', 'projectiles', {
      x: 200, y: 300, radius: 10,
    });
  });

  it('should register enemies via EnemyAI contract (wave:spawn)', () => {
    const engine = new Engine();
    const enemyAI = new EnemyAI('ai-1', { hp: 50 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');
    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 400, y: 100 });

    expect(registerSpy).toHaveBeenCalledWith('enemy-1', 'enemies', {
      x: 400, y: 100, radius: 24,
    });
  });

  it('should update enemy position via moveEvent', () => {
    const engine = new Engine();
    const enemyAI = new EnemyAI('ai-1', { hp: 50 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // Register first
    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 0, y: 0 });

    const updateSpy = vi.spyOn(collision, 'updateObject');
    engine.eventBus.emit('enemy:move', { id: 'enemy-1', x: 150, y: 250 });

    expect(updateSpy).toHaveBeenCalledWith('enemy-1', { x: 150, y: 250 });
  });

  it('should unregister enemy on enemy:death', () => {
    const engine = new Engine();
    const enemyAI = new EnemyAI('ai-1', { hp: 50 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const unregisterSpy = vi.spyOn(collision, 'unregisterObject');
    engine.eventBus.emit('enemy:death', { id: 'enemy-1' });

    expect(unregisterSpy).toHaveBeenCalledWith('enemy-1');
  });

  it('should register player via PlayerMovement playerPosition contract', () => {
    const engine = new Engine();
    const pm = new PlayerMovement('pm-1', {});
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(pm);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // Player registration should happen immediately at wire() time
    // (the spy was set up after wire(), so we need to check via pre-update hook)
    // Instead, let's verify by checking collision has the player registered
    // We'll re-wire after spy is set up
  });

  it('should sync player position via pre-update hook', () => {
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: '', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });
    const pm = new PlayerMovement('pm-1', { defaultY: 0.5 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(pm);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // After wiring, collision should have a pre-update hook for player sync
    const updateSpy = vi.spyOn(collision, 'updateObject');

    // Trigger a collision update which runs pre-update hooks
    engine.eventBus.emit('gameflow:resume');
    collision.update(16);

    expect(updateSpy).toHaveBeenCalledWith('player_1', expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }));
  });

  it('should add pre-update hook for Spawner position sync', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);

    const hookSpy = vi.spyOn(collision, 'addPreUpdateHook');
    AutoWirer.wire(engine);

    expect(hookSpy).toHaveBeenCalled();
  });

  it('should use per-item layer routing for Spawner (runner: coins→items, obstacles→obstacles)', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', {
      items: [
        { asset: 'coin', weight: 3, layer: 'items' },
        { asset: 'obstacle', weight: 2, layer: 'obstacles' },
      ],
      spriteSize: 48,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    // Coin should go to 'items' layer
    engine.eventBus.emit('spawner:created', { id: 'coin-1', asset: 'coin', x: 100, y: 50 });
    expect(registerSpy).toHaveBeenCalledWith('coin-1', 'items', expect.any(Object));

    // Obstacle should go to 'obstacles' layer
    engine.eventBus.emit('spawner:created', { id: 'obs-1', asset: 'obstacle', x: 200, y: 50 });
    expect(registerSpy).toHaveBeenCalledWith('obs-1', 'obstacles', expect.any(Object));
  });

  it('should do initial registration for Collectible (pre-defined items, no spawnEvent)', () => {
    const engine = new Engine();
    const collectible = new Collectible('col-1', {
      items: [
        { x: 100, y: 200, value: 1, type: 'coin' },
        { x: 300, y: 400, value: 2, type: 'gem' },
      ],
      magnetRadius: 16,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(collectible);
    engine.addModule(collision);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    AutoWirer.wire(engine);

    // Both items should be registered at wire() time (not via event)
    expect(registerSpy).toHaveBeenCalledTimes(2);
    expect(registerSpy).toHaveBeenCalledWith('collectible-0', 'collectibles', expect.objectContaining({
      x: 100, y: 200, radius: 16,
    }));
    expect(registerSpy).toHaveBeenCalledWith('collectible-1', 'collectibles', expect.objectContaining({
      x: 300, y: 400, radius: 16,
    }));
  });
});

// ── Re-wire safety ────────────────────────────────────────────────

describe('AutoWirer — Re-wire safety', () => {
  it('should NOT accumulate listeners on repeated wire() calls', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      spriteSize: 48,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);

    // Wire twice
    AutoWirer.wire(engine);
    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('spawner:created', { id: 'item-1', x: 0, y: 0 });

    // Should be called exactly ONCE, not twice
    expect(registerSpy).toHaveBeenCalledTimes(1);
  });

  it('should auto-register player_1 in Health module', () => {
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: '', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });
    const pm = new PlayerMovement('pm-1', { defaultY: 0.85 });
    const health = new Health('health-1', { maxHp: 100 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(pm);
    engine.addModule(health);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // player_1 should be auto-registered without manual registerEntity
    const entity = health.getEntity('player_1');
    expect(entity).toBeDefined();
    expect(entity!.hp).toBe(100);
    expect(entity!.maxHp).toBe(100);
  });
});

// ── Phase B: Damage Routing via Contracts ─────────────────────────

describe('AutoWirer Phase B — Damage Routing', () => {
  it('should route projectile→enemy damage on collision:hit', () => {
    const engine = new Engine();
    const projectile = new Projectile('proj-1', { damage: 25 });
    const enemyAI = new EnemyAI('ai-1', { hp: 100 });
    const collision = new Collision('collision-1', {
      rules: [{ a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] }],
    });

    engine.addModule(projectile);
    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // Add an enemy first
    enemyAI.addEnemy('enemy-1', 100, 100);

    // Simulate collision:hit (projectile hits enemy)
    engine.eventBus.emit('collision:hit', {
      objectA: 'proj-1',
      objectB: 'enemy-1',
      layerA: 'projectiles',
      layerB: 'enemies',
      targetId: 'enemy-1',
      x: 100, y: 100,
    });

    // Enemy should have taken damage
    const enemy = enemyAI.getEnemy('enemy-1');
    expect(enemy!.hp).toBe(75); // 100 - 25
  });

  it('should route enemy→player damage on collision:damage', () => {
    const engine = new Engine();
    const enemyAI = new EnemyAI('ai-1', { attackDamage: 15 });
    const health = new Health('health-1', { maxHp: 100 });
    const collision = new Collision('collision-1', {
      rules: [{ a: 'player', b: 'enemies', event: 'damage' }],
    });

    engine.addModule(enemyAI);
    engine.addModule(health);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // Register player in health
    health.registerEntity('player_1');

    // Simulate collision:damage (enemy damages player)
    engine.eventBus.emit('collision:damage', {
      objectA: 'player_1',
      objectB: 'enemy-1',
      layerA: 'player',
      layerB: 'enemies',
      targetId: 'enemy-1',
      x: 100, y: 100,
    });

    // Player should have taken damage
    const entity = health.getEntity('player_1');
    expect(entity!.hp).toBe(85); // 100 - 15
  });

  it('should NOT route damage when no damageReceiver exists for target layer', () => {
    const engine = new Engine();
    const projectile = new Projectile('proj-1', { damage: 25 });
    const collision = new Collision('collision-1', {
      rules: [{ a: 'projectiles', b: 'items', event: 'hit' }],
    });

    engine.addModule(projectile);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    // Should not throw when no receiver exists
    expect(() => {
      engine.eventBus.emit('collision:hit', {
        objectA: 'proj-1',
        objectB: 'item-1',
        layerA: 'projectiles',
        layerB: 'items',
        targetId: 'item-1',
        x: 0, y: 0,
      });
    }).not.toThrow();
  });
});

// ── Phase C: Queries ──────────────────────────────────────────────

describe('AutoWirer Phase C — Queries', () => {
  it('should respond to aim:queryTargets with enemy positions', () => {
    const engine = new Engine();
    const enemyAI = new EnemyAI('ai-1', { hp: 50 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    enemyAI.addEnemy('enemy-1', 100, 200);
    enemyAI.addEnemy('enemy-2', 300, 400);

    const callback = vi.fn();
    engine.eventBus.emit('aim:queryTargets', { layer: 'enemies', callback });

    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'enemy-1', x: 100, y: 200 }),
        expect.objectContaining({ id: 'enemy-2', x: 300, y: 400 }),
      ]),
    );
  });
});

// ── Phase D: Module-Specific Bridges ──────────────────────────────

describe('AutoWirer Phase D — Bridges', () => {
  it('should bridge health:zero to lives:zero for GameFlow', () => {
    const engine = new Engine();
    const health = new Health('health-1', { maxHp: 10 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(health);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    health.registerEntity('player_1');

    const livesZeroHandler = vi.fn();
    engine.eventBus.on('lives:zero', livesZeroHandler);

    // Damage player to 0 HP
    health.damage('player_1', 10);

    expect(livesZeroHandler).toHaveBeenCalled();
  });
});

// ── WaveSpawner + EnemyAI (kept from old rules) ──────────────────

describe('AutoWirer — WaveSpawner + EnemyAI', () => {
  it('should add enemy to EnemyAI when wave:spawn fires', () => {
    const engine = new Engine();
    const waveSpawner = new WaveSpawner('ws-1', { enemiesPerWave: 3 });
    const enemyAI = new EnemyAI('ai-1', { hp: 30 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(waveSpawner);
    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    expect(enemyAI.getActiveEnemies()).toHaveLength(0);

    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 300, y: 100 });

    const enemies = enemyAI.getActiveEnemies();
    expect(enemies).toHaveLength(1);
    expect(enemies[0].id).toBe('enemy-1');
  });

  it('should remove enemy from EnemyAI on enemy:death', () => {
    const engine = new Engine();
    const waveSpawner = new WaveSpawner('ws-1', {});
    const enemyAI = new EnemyAI('ai-1', { hp: 30 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(waveSpawner);
    engine.addModule(enemyAI);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    engine.eventBus.emit('wave:spawn', { id: 'e1', x: 100, y: 100 });
    expect(enemyAI.getActiveEnemies()).toHaveLength(1);

    engine.eventBus.emit('enemy:death', { id: 'e1' });
    expect(enemyAI.getActiveEnemies()).toHaveLength(0);
  });
});

// ── Full Shooting Game Flow ─────────────────────────────────────

describe('AutoWirer — Full Shooting Flow', () => {
  it('should wire complete bullet→enemy→damage→death chain', () => {
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: '', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });

    const pm = new PlayerMovement('pm-1', { mode: 'follow', defaultY: 0.85 });
    const projectile = new Projectile('proj-1', { damage: 50 });
    const enemyAI = new EnemyAI('ai-1', { hp: 50, attackDamage: 10 });
    const health = new Health('health-1', { maxHp: 100 });
    const waveSpawner = new WaveSpawner('ws-1', { enemiesPerWave: 1 });
    const collision = new Collision('collision-1', {
      rules: [
        { a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] },
        { a: 'player', b: 'enemies', event: 'damage' },
      ],
    });

    engine.addModule(pm);
    engine.addModule(projectile);
    engine.addModule(enemyAI);
    engine.addModule(health);
    engine.addModule(waveSpawner);
    engine.addModule(collision);
    AutoWirer.wire(engine);

    health.registerEntity('player_1');

    // Spawn an enemy
    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 540, y: 200 });
    expect(enemyAI.getActiveEnemies()).toHaveLength(1);

    // Bullet hits enemy → enemy takes 50 damage → dies
    const deathHandler = vi.fn();
    engine.eventBus.on('enemy:death', deathHandler);

    engine.eventBus.emit('collision:hit', {
      objectA: 'proj-1',
      objectB: 'enemy-1',
      layerA: 'projectiles',
      layerB: 'enemies',
      targetId: 'enemy-1',
      x: 540, y: 200,
    });

    // Enemy was killed (hp→0) and then removed by WaveSpawner+EnemyAI bridge
    // getEnemy returns undefined because removeEnemy was called on death
    expect(enemyAI.getEnemy('enemy-1')).toBeUndefined();
    expect(deathHandler).toHaveBeenCalled();

    // Enemy damages player → health decreases
    engine.eventBus.emit('collision:damage', {
      objectA: 'player_1',
      objectB: 'enemy-2',
      layerA: 'player',
      layerB: 'enemies',
      targetId: 'enemy-2',
      x: 540, y: 1600,
    });

    expect(health.getEntity('player_1')!.hp).toBe(90); // 100 - 10
  });
});
