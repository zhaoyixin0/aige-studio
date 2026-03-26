import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { EnemyAI } from '../mechanic/enemy-ai';

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  const mod = new EnemyAI('enemy-ai-1', params);
  engine.addModule(mod);
  engine.eventBus.emit('gameflow:resume');
  return { engine, mod };
}

describe('EnemyAI', () => {
  it('should add enemy with default HP', () => {
    const { mod } = setup({ hp: 50 });
    mod.addEnemy('e1', 100, 200);

    const enemy = mod.getEnemy('e1');
    expect(enemy).toBeDefined();
    expect(enemy!.id).toBe('e1');
    expect(enemy!.x).toBe(100);
    expect(enemy!.y).toBe(200);
    expect(enemy!.hp).toBe(50);
    expect(enemy!.maxHp).toBe(50);
    expect(enemy!.state).toBe('idle');
  });

  it('should move enemy along waypoints in patrol state', () => {
    const waypoints = [{ x: 0, y: 200 }, { x: 400, y: 200 }];
    const { engine, mod } = setup({
      behavior: 'patrol',
      speed: 200,
      waypoints,
      detectionRange: 10, // very small to avoid chase
    });

    mod.addEnemy('e1', 0, 200);
    // Force patrol state
    const enemy = mod.getEnemy('e1')!;
    enemy.state = 'patrol';

    const initialX = enemy.x;
    engine.tick(500); // 0.5s at speed 200 → should move ~100px

    const updated = mod.getEnemy('e1')!;
    expect(updated.x).toBeGreaterThan(initialX);
  });

  it('should transition to chase when player is in detection range', () => {
    const { engine, mod } = setup({
      behavior: 'patrol',
      detectionRange: 200,
      waypoints: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
    });

    mod.addEnemy('e1', 100, 100);
    const enemy = mod.getEnemy('e1')!;
    enemy.state = 'patrol';

    // Player moves within detection range
    engine.eventBus.emit('player:move', { x: 110, y: 110 }); // ~14px away
    engine.tick(16);

    expect(mod.getEnemy('e1')!.state).toBe('chase');
  });

  it('should transition to attack when player is in attack range', () => {
    const { engine, mod } = setup({
      detectionRange: 300,
      attackRange: 60,
    });

    mod.addEnemy('e1', 100, 100);
    const enemy = mod.getEnemy('e1')!;
    enemy.state = 'chase';

    // Player very close
    engine.eventBus.emit('player:move', { x: 110, y: 110 }); // ~14px away
    engine.tick(16);

    expect(mod.getEnemy('e1')!.state).toBe('attack');
  });

  it('should emit enemy:attack on cooldown', () => {
    const { engine, mod } = setup({
      attackRange: 200,
      attackCooldown: 500,
      attackDamage: 15,
    });

    mod.addEnemy('e1', 100, 100);
    const enemy = mod.getEnemy('e1')!;
    enemy.state = 'attack';

    engine.eventBus.emit('player:move', { x: 120, y: 120 });

    const handler = vi.fn();
    engine.eventBus.on('enemy:attack', handler);

    engine.tick(600); // > cooldown of 500ms

    expect(handler).toHaveBeenCalled();
    const payload = handler.mock.calls[0][0] as { id: string; damage: number };
    expect(payload.id).toBe('e1');
    expect(payload.damage).toBe(15);
  });

  it('should transition to dead and emit enemy:death when HP reaches 0', () => {
    const { mod, engine } = setup({ hp: 30 });
    mod.addEnemy('e1', 100, 100);

    const handler = vi.fn();
    engine.eventBus.on('enemy:death', handler);

    mod.damageEnemy('e1', 30);
    engine.tick(16);

    expect(mod.getEnemy('e1')!.state).toBe('dead');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('should flee when HP drops below threshold', () => {
    const { mod, engine } = setup({
      hp: 100,
      fleeHpThreshold: 0.3,
    });

    mod.addEnemy('e1', 100, 100);
    const enemy = mod.getEnemy('e1')!;
    enemy.state = 'chase';

    engine.eventBus.emit('player:move', { x: 120, y: 120 });

    // Damage to below 30%
    mod.damageEnemy('e1', 75); // HP = 25, threshold = 30
    engine.tick(16);

    expect(mod.getEnemy('e1')!.state).toBe('flee');
  });

  it('should respond to projectile:hit events', () => {
    const { engine, mod } = setup({ hp: 50 });
    mod.addEnemy('e1', 100, 100);

    engine.eventBus.emit('projectile:hit', { targetId: 'e1', damage: 20 });

    expect(mod.getEnemy('e1')!.hp).toBe(30);
  });

  it('should reset all enemies on reset', () => {
    const { mod } = setup();
    mod.addEnemy('e1', 0, 0);
    mod.addEnemy('e2', 100, 100);

    expect(mod.getActiveEnemies()).toHaveLength(2);

    mod.reset();

    expect(mod.getActiveEnemies()).toHaveLength(0);
  });
});
