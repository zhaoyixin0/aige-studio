import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Health } from '../mechanic/health';

describe('Health', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const health = new Health('health-1', params);
    engine.addModule(health);
    engine.eventBus.emit('gameflow:resume');
    return { engine, health };
  }

  it('should register entity with default maxHp', () => {
    const { health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');
    const entity = health.getEntity('enemy-1');

    expect(entity).toBeDefined();
    expect(entity!.id).toBe('enemy-1');
    expect(entity!.maxHp).toBe(100);
    expect(entity!.hp).toBe(100);
  });

  it('should register entity with custom maxHp', () => {
    const { health } = setup({ maxHp: 100 });
    health.registerEntity('boss-1', 500);
    const entity = health.getEntity('boss-1');

    expect(entity!.hp).toBe(500);
    expect(entity!.maxHp).toBe(500);
  });

  it('should damage entity and emit health:change', () => {
    const { engine, health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');

    const changeHandler = vi.fn();
    engine.eventBus.on('health:change', changeHandler);

    health.damage('enemy-1', 30);

    expect(health.getEntity('enemy-1')!.hp).toBe(70);
    expect(changeHandler).toHaveBeenCalledOnce();
    expect(changeHandler).toHaveBeenCalledWith({
      id: 'enemy-1',
      hp: 70,
      maxHp: 100,
      delta: -30,
    });
  });

  it('should emit health:zero when HP reaches 0', () => {
    const { engine, health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');

    const zeroHandler = vi.fn();
    engine.eventBus.on('health:zero', zeroHandler);

    health.damage('enemy-1', 100);

    expect(health.getEntity('enemy-1')!.hp).toBe(0);
    expect(zeroHandler).toHaveBeenCalledOnce();
    expect(zeroHandler).toHaveBeenCalledWith({ id: 'enemy-1' });
  });

  it('should not go below 0 HP', () => {
    const { engine, health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');

    const zeroHandler = vi.fn();
    engine.eventBus.on('health:zero', zeroHandler);

    health.damage('enemy-1', 80);
    health.damage('enemy-1', 80);

    expect(health.getEntity('enemy-1')!.hp).toBe(0);
    // health:zero only fires once (second damage at 0 HP is ignored)
    expect(zeroHandler).toHaveBeenCalledTimes(1);
  });

  it('should heal entity up to maxHp', () => {
    const { engine, health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');
    health.damage('enemy-1', 50);

    const changeHandler = vi.fn();
    engine.eventBus.on('health:change', changeHandler);

    health.heal('enemy-1', 30);
    expect(health.getEntity('enemy-1')!.hp).toBe(80);
    expect(changeHandler).toHaveBeenCalledWith({
      id: 'enemy-1',
      hp: 80,
      maxHp: 100,
      delta: 30,
    });
  });

  it('should not heal above maxHp', () => {
    const { health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');
    health.damage('enemy-1', 10);

    health.heal('enemy-1', 999);
    expect(health.getEntity('enemy-1')!.hp).toBe(100);
  });

  it('should respond to configured damageEvent', () => {
    const { engine, health } = setup({
      maxHp: 100,
      damageEvent: 'collision:damage',
    });
    health.registerEntity('target-1');

    engine.eventBus.emit('collision:damage', { targetId: 'target-1', amount: 25 });

    expect(health.getEntity('target-1')!.hp).toBe(75);
  });

  it('should respond to configured healEvent', () => {
    const { engine, health } = setup({
      maxHp: 100,
      healEvent: 'pickup:heal',
    });
    health.registerEntity('player-1');
    health.damage('player-1', 50);

    engine.eventBus.emit('pickup:heal', { targetId: 'player-1', amount: 20 });

    expect(health.getEntity('player-1')!.hp).toBe(70);
  });

  it('should not listen to healEvent when it is empty string', () => {
    const { engine, health } = setup({
      maxHp: 100,
      healEvent: '',
    });
    health.registerEntity('player-1');
    health.damage('player-1', 50);

    // Emitting empty string event should not crash or heal
    engine.eventBus.emit('', { targetId: 'player-1', amount: 20 });

    expect(health.getEntity('player-1')!.hp).toBe(50);
  });

  it('should clear all entities on reset', () => {
    const { health } = setup({ maxHp: 100 });
    health.registerEntity('enemy-1');
    health.registerEntity('enemy-2');

    health.reset();

    expect(health.getEntity('enemy-1')).toBeUndefined();
    expect(health.getEntity('enemy-2')).toBeUndefined();
  });

  it('should ignore damage for unknown entity id', () => {
    const { health } = setup({ maxHp: 100 });
    // Should not throw
    expect(() => health.damage('nonexistent', 50)).not.toThrow();
  });

  it('should ignore heal for unknown entity id', () => {
    const { health } = setup({ maxHp: 100 });
    expect(() => health.heal('nonexistent', 50)).not.toThrow();
  });

  it('should have correct default schema values', () => {
    const { health } = setup();
    const params = health.getParams();

    expect(params.maxHp).toBe(100);
    expect(params.damageEvent).toBe('collision:damage');
    expect(params.healEvent).toBe('');
    expect(params.showBar).toBe(true);
  });
});
