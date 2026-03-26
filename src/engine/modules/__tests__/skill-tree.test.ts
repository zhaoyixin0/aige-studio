import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { SkillTree } from '../mechanic/skill-tree';

const SKILL_A = {
  id: 'skill-a',
  name: 'Fireball',
  prerequisites: [],
  cost: 1,
  cooldown: 3000,
  effect: 'spell:fireball',
  effectData: { damage: 50 },
};

const SKILL_B = {
  id: 'skill-b',
  name: 'Inferno',
  prerequisites: ['skill-a'],
  cost: 2,
  cooldown: 5000,
  effect: 'spell:inferno',
  effectData: { damage: 150 },
};

const PASSIVE_SKILL = {
  id: 'skill-passive',
  name: 'Fortitude',
  prerequisites: [],
  cost: 1,
  cooldown: 0,
  effect: 'buff:fortitude',
  effectData: { armor: 10 },
};

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  const mod = new SkillTree('st-1', {
    skills: [SKILL_A, SKILL_B, PASSIVE_SKILL],
    ...params,
  });
  engine.addModule(mod);
  engine.eventBus.emit('gameflow:resume');
  return { engine, mod };
}

describe('SkillTree', () => {
  it('should start with no unlocked skills and 0 points', () => {
    const { mod } = setup();
    expect(mod.getUnlockedSkills()).toEqual([]);
    expect(mod.getAvailablePoints()).toBe(0);
  });

  it('should unlock skill when prerequisites met and points sufficient', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });

    const result = mod.unlockSkill('skill-a');

    expect(result).toBe(true);
    expect(mod.isUnlocked('skill-a')).toBe(true);
    expect(mod.getAvailablePoints()).toBe(0);
  });

  it('should not unlock when prerequisites not met', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 2 });

    const result = mod.unlockSkill('skill-b');

    expect(result).toBe(false);
    expect(mod.isUnlocked('skill-b')).toBe(false);
    expect(mod.getAvailablePoints()).toBe(2);
  });

  it('should not unlock when insufficient points', () => {
    const { mod } = setup();

    const result = mod.unlockSkill('skill-a');

    expect(result).toBe(false);
    expect(mod.isUnlocked('skill-a')).toBe(false);
  });

  it('should emit skill:unlock on successful unlock', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    const handler = vi.fn();
    engine.eventBus.on('skill:unlock', handler);

    mod.unlockSkill('skill-a');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-a', name: 'Fireball' }),
    );
  });

  it('should activate skill and emit effect event', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    mod.unlockSkill('skill-a');

    const effectHandler = vi.fn();
    const activateHandler = vi.fn();
    engine.eventBus.on('spell:fireball', effectHandler);
    engine.eventBus.on('skill:activate', activateHandler);

    const result = mod.activateSkill('skill-a');

    expect(result).toBe(true);
    expect(effectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ damage: 50 }),
    );
    expect(activateHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-a', name: 'Fireball' }),
    );
  });

  it('should block activation during cooldown', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    mod.unlockSkill('skill-a');
    mod.activateSkill('skill-a');

    const result = mod.activateSkill('skill-a');

    expect(result).toBe(false);
    expect(mod.getCooldownRemaining('skill-a')).toBeGreaterThan(0);
  });

  it('should decrement cooldown over time', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    mod.unlockSkill('skill-a');
    mod.activateSkill('skill-a');

    const beforeCd = mod.getCooldownRemaining('skill-a');
    mod.update(1000);
    const afterCd = mod.getCooldownRemaining('skill-a');

    expect(afterCd).toBe(beforeCd - 1000);
  });

  it('should receive skill points from levelup:levelup events', () => {
    const { engine, mod } = setup();

    engine.eventBus.emit('levelup:levelup', { skillPoints: 3 });
    expect(mod.getAvailablePoints()).toBe(3);

    engine.eventBus.emit('levelup:levelup', { skillPoints: 2 });
    expect(mod.getAvailablePoints()).toBe(5);
  });

  it('should reset all unlocked skills and points', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    mod.unlockSkill('skill-a');

    mod.reset();

    expect(mod.getUnlockedSkills()).toEqual([]);
    expect(mod.getAvailablePoints()).toBe(0);
  });

  it('should not activate non-existent skill', () => {
    const { mod } = setup();
    const result = mod.activateSkill('nonexistent');
    expect(result).toBe(false);
  });

  it('should not unlock unknown skill id', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 5 });
    const result = mod.unlockSkill('nonexistent');
    expect(result).toBe(false);
  });

  it('should activate passive skill (cooldown 0) multiple times', () => {
    const { engine, mod } = setup();
    engine.eventBus.emit('levelup:levelup', { skillPoints: 1 });
    mod.unlockSkill('skill-passive');

    const r1 = mod.activateSkill('skill-passive');
    const r2 = mod.activateSkill('skill-passive');

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(mod.getCooldownRemaining('skill-passive')).toBe(0);
  });
});
