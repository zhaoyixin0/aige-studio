import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { StatusEffect } from '../mechanic/status-effect';

describe('StatusEffect', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new StatusEffect('status-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  it('should apply effect and emit status:apply', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('status:apply', handler);

    mod.applyEffect({ name: 'burn', type: 'debuff', duration: 3000 });

    expect(mod.hasEffect('burn')).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'burn', type: 'debuff', duration: 3000 }),
    );
  });

  it('should expire effect after duration and emit status:expire', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('status:expire', handler);

    mod.applyEffect({ name: 'burn', type: 'debuff', duration: 1000 });
    mod.update(1001);

    expect(mod.hasEffect('burn')).toBe(false);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'burn' }),
    );
  });

  it('should stack same effect up to maxStacks', () => {
    const { engine, mod } = setup();
    const stackHandler = vi.fn();
    engine.eventBus.on('status:stack', stackHandler);

    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, maxStacks: 3 });
    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, maxStacks: 3 });

    const effects = mod.getActiveEffects();
    const poison = effects.find((e) => e.name === 'poison');
    expect(poison?.stacks).toBe(2);
    expect(stackHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'poison', stacks: 2 }),
    );
  });

  it('should not exceed maxStacks', () => {
    const { mod } = setup();

    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, maxStacks: 2 });
    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, maxStacks: 2 });
    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, maxStacks: 2 });

    const effects = mod.getActiveEffects();
    const poison = effects.find((e) => e.name === 'poison');
    expect(poison?.stacks).toBe(2);
  });

  it('should emit status:tick at tickInterval', () => {
    const { engine, mod } = setup();
    const tickHandler = vi.fn();
    engine.eventBus.on('status:tick', tickHandler);

    mod.applyEffect({
      name: 'bleed',
      type: 'debuff',
      duration: 5000,
      tickInterval: 500,
      tickValue: 10,
    });

    mod.update(500);
    expect(tickHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bleed', value: 10 }),
    );

    mod.update(500);
    expect(tickHandler).toHaveBeenCalledTimes(2);
  });

  it('should block immune effects and emit status:immunity', () => {
    const { engine, mod } = setup({ immunities: ['stun'] });
    const immunityHandler = vi.fn();
    engine.eventBus.on('status:immunity', immunityHandler);

    mod.applyEffect({ name: 'stun', type: 'debuff', duration: 2000 });

    expect(mod.hasEffect('stun')).toBe(false);
    expect(immunityHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'stun' }),
    );
  });

  it('should aggregate flat and multiply modifiers correctly', () => {
    const { mod } = setup();

    mod.applyEffect({
      name: 'strength',
      type: 'buff',
      duration: 5000,
      modifiers: [
        { stat: 'attack', value: 10, mode: 'flat' },
        { stat: 'speed', value: 1.5, mode: 'multiply' },
      ],
    });
    mod.applyEffect({
      name: 'fury',
      type: 'buff',
      duration: 5000,
      modifiers: [
        { stat: 'attack', value: 5, mode: 'flat' },
      ],
    });

    const mods = mod.getAggregatedModifiers();
    const attackFlat = mods.filter((m) => m.stat === 'attack' && m.mode === 'flat');
    const totalAttack = attackFlat.reduce((sum, m) => sum + m.value, 0);
    expect(totalAttack).toBe(15);

    const speedMul = mods.find((m) => m.stat === 'speed' && m.mode === 'multiply');
    expect(speedMul?.value).toBe(1.5);
  });

  it('should remove specific effect by name', () => {
    const { mod } = setup();

    mod.applyEffect({ name: 'burn', type: 'debuff', duration: 5000 });
    mod.applyEffect({ name: 'freeze', type: 'debuff', duration: 5000 });

    mod.removeEffect('burn');

    expect(mod.hasEffect('burn')).toBe(false);
    expect(mod.hasEffect('freeze')).toBe(true);
  });

  it('should clear all effects on reset', () => {
    const { mod } = setup();

    mod.applyEffect({ name: 'burn', type: 'debuff', duration: 5000 });
    mod.applyEffect({ name: 'haste', type: 'buff', duration: 3000 });

    mod.reset();

    expect(mod.getActiveEffects()).toHaveLength(0);
  });

  it('should not exceed maxEffects limit', () => {
    const { mod } = setup({ maxEffects: 2 });

    mod.applyEffect({ name: 'effect1', type: 'debuff', duration: 5000 });
    mod.applyEffect({ name: 'effect2', type: 'debuff', duration: 5000 });
    mod.applyEffect({ name: 'effect3', type: 'debuff', duration: 5000 });

    expect(mod.getActiveEffects()).toHaveLength(2);
  });

  it('should reset duration when stacking', () => {
    const { mod } = setup();

    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 1000, maxStacks: 3 });
    mod.update(800);
    // re-apply resets duration
    mod.applyEffect({ name: 'poison', type: 'debuff', duration: 1000, maxStacks: 3 });

    // now only 200ms left would have expired, but duration was reset to 1000
    mod.update(500);
    expect(mod.hasEffect('poison')).toBe(true);
  });
});
