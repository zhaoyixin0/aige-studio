import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { LevelUp } from '../mechanic/level-up';

describe('LevelUp', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new LevelUp('level-up-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  it('should start at level 1 with 0 XP', () => {
    const { mod } = setup();
    expect(mod.getLevel()).toBe(1);
    expect(mod.getXp()).toBe(0);
  });

  it('should add XP and emit levelup:xp', () => {
    const { engine, mod } = setup({ xpPerLevel: 100 });
    const handler = vi.fn();
    engine.eventBus.on('levelup:xp', handler);

    mod.addXp(30);

    expect(mod.getXp()).toBe(30);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ xp: 30, totalXp: 30, level: 1 }),
    );
  });

  it('should level up when XP exceeds threshold', () => {
    const { mod } = setup({ xpPerLevel: 100, scalingCurve: 'linear' });
    // linear: xpPerLevel * level = 100 * 1 = 100
    mod.addXp(100);
    expect(mod.getLevel()).toBe(2);
    expect(mod.getXp()).toBe(0);
  });

  it('should emit levelup:levelup on level up with correct stats', () => {
    const { engine, mod } = setup({
      xpPerLevel: 100,
      scalingCurve: 'linear',
      statGrowth: { hp: 10, attack: 2, defense: 1 },
    });
    const handler = vi.fn();
    engine.eventBus.on('levelup:levelup', handler);

    mod.addXp(100);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 2,
        stats: expect.objectContaining({ hp: expect.any(Number) }),
      }),
    );
  });

  it('should scale XP threshold with quadratic curve', () => {
    const { mod } = setup({ xpPerLevel: 100, scalingCurve: 'quadratic' });
    // quadratic: floor(xpPerLevel * level^1.5) = floor(100 * 1^1.5) = 100
    mod.addXp(99);
    expect(mod.getLevel()).toBe(1); // 99 < 100, still level 1

    mod.addXp(1); // now 100 >= 100, level up
    expect(mod.getLevel()).toBe(2);

    // At level 2: threshold = floor(100 * 2^1.5) = floor(282.84) = 282
    mod.addXp(281);
    expect(mod.getLevel()).toBe(2); // 281 < 282, still level 2

    mod.addXp(1); // now 282 >= 282, level up
    expect(mod.getLevel()).toBe(3);
  });

  it('should not exceed maxLevel', () => {
    const { mod } = setup({ xpPerLevel: 10, scalingCurve: 'linear', maxLevel: 3 });
    mod.addXp(999999);
    expect(mod.getLevel()).toBe(3);
  });

  it('should award skill points on level up', () => {
    const { mod } = setup({ xpPerLevel: 100, scalingCurve: 'linear' });
    expect(mod.getSkillPoints()).toBe(0);
    mod.addXp(100);
    expect(mod.getSkillPoints()).toBe(1);
  });

  it('should respond to xpSource event', () => {
    const { engine, mod } = setup({
      xpPerLevel: 100,
      scalingCurve: 'linear',
      xpSource: 'enemy:death',
      xpAmount: 25,
    });

    engine.eventBus.emit('enemy:death', {});
    expect(mod.getXp()).toBe(25);
  });

  it('should handle multiple level ups from large XP gain', () => {
    const { mod } = setup({ xpPerLevel: 10, scalingCurve: 'linear' });
    // level 1 → threshold = 10*1=10, level 2 → 10*2=20, level 3 → 10*3=30
    // 10+20+30 = 60 XP total to reach level 4
    mod.addXp(60);
    expect(mod.getLevel()).toBe(4);
  });

  it('should reset to level 1 on reset', () => {
    const { mod } = setup({ xpPerLevel: 100, scalingCurve: 'linear' });
    mod.addXp(100);
    expect(mod.getLevel()).toBe(2);

    mod.reset();
    expect(mod.getLevel()).toBe(1);
    expect(mod.getXp()).toBe(0);
    expect(mod.getSkillPoints()).toBe(0);
  });

  it('should return stats scaled by level growth', () => {
    const { mod } = setup({
      xpPerLevel: 100,
      scalingCurve: 'linear',
      statGrowth: { hp: 10, attack: 2, defense: 1 },
    });

    const statsL1 = mod.getStats();
    expect(statsL1.hp).toBe(10);
    expect(statsL1.attack).toBe(2);

    mod.addXp(100);
    const statsL2 = mod.getStats();
    expect(statsL2.hp).toBe(20);
    expect(statsL2.attack).toBe(4);
  });

  it('should use amount from event data if available', () => {
    const { engine, mod } = setup({
      xpSource: 'enemy:death',
      xpAmount: 10,
    });

    engine.eventBus.emit('enemy:death', { amount: 50 });
    expect(mod.getXp()).toBe(50);
  });
});
