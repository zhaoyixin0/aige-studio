import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Shield } from '../mechanic/shield';

describe('Shield', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const shield = new Shield('shield-1', params);
    engine.addModule(shield);
    engine.eventBus.emit('gameflow:resume');
    return { engine, shield };
  }

  it('should start with maxCharges', () => {
    const { shield } = setup({ maxCharges: 3 });
    expect(shield.getCharges()).toBe(3);
    expect(shield.isActive()).toBe(true);
  });

  it('should absorb damage and emit shield:block', () => {
    const { engine, shield } = setup({ maxCharges: 3 });

    const blockHandler = vi.fn();
    engine.eventBus.on('shield:block', blockHandler);

    const absorbed = shield.absorb();

    expect(absorbed).toBe(true);
    expect(shield.getCharges()).toBe(2);
    expect(blockHandler).toHaveBeenCalledOnce();
    expect(blockHandler).toHaveBeenCalledWith({ chargesRemaining: 2 });
  });

  it('should emit shield:break when last charge is used', () => {
    const { engine, shield } = setup({ maxCharges: 1 });

    const breakHandler = vi.fn();
    engine.eventBus.on('shield:break', breakHandler);

    shield.absorb();

    expect(shield.getCharges()).toBe(0);
    expect(shield.isActive()).toBe(false);
    expect(breakHandler).toHaveBeenCalledOnce();
  });

  it('should not absorb when charges are 0', () => {
    const { engine, shield } = setup({ maxCharges: 1 });

    const blockHandler = vi.fn();
    engine.eventBus.on('shield:block', blockHandler);

    shield.absorb(); // use last charge
    const absorbed = shield.absorb(); // should fail

    expect(absorbed).toBe(false);
    expect(shield.getCharges()).toBe(0);
    expect(blockHandler).toHaveBeenCalledTimes(1);
  });

  it('should recharge after cooldown period', () => {
    const { shield } = setup({ maxCharges: 3, rechargeCooldown: 5000 });

    shield.absorb(); // 3 → 2
    expect(shield.getCharges()).toBe(2);

    shield.update(3000);
    expect(shield.getCharges()).toBe(2); // not yet

    shield.update(2000); // total 5000ms
    expect(shield.getCharges()).toBe(3);
  });

  it('should emit shield:recharge event when charge restores', () => {
    const { engine, shield } = setup({ maxCharges: 3, rechargeCooldown: 1000 });

    const rechargeHandler = vi.fn();
    engine.eventBus.on('shield:recharge', rechargeHandler);

    shield.absorb(); // 3 → 2
    shield.update(1000);

    expect(rechargeHandler).toHaveBeenCalledOnce();
    expect(rechargeHandler).toHaveBeenCalledWith({ chargesRemaining: 3 });
  });

  it('should not recharge above maxCharges', () => {
    const { shield } = setup({ maxCharges: 3, rechargeCooldown: 1000 });

    // Already at max — update should not go above max
    shield.update(2000);
    expect(shield.getCharges()).toBe(3);
  });

  it('should recharge one charge at a time', () => {
    const { shield } = setup({ maxCharges: 3, rechargeCooldown: 1000 });

    shield.absorb(); // 3 → 2
    shield.absorb(); // 2 → 1

    shield.update(1000); // restore 1 charge
    expect(shield.getCharges()).toBe(2);

    shield.update(1000); // restore another
    expect(shield.getCharges()).toBe(3);
  });

  it('should reset timer after each recharge', () => {
    const { shield } = setup({ maxCharges: 3, rechargeCooldown: 2000 });

    shield.absorb(); // 3 → 2
    shield.update(2000); // restore → 3

    shield.absorb(); // 3 → 2
    shield.update(1000); // not enough
    expect(shield.getCharges()).toBe(2);
    shield.update(1000); // now enough
    expect(shield.getCharges()).toBe(3);
  });

  it('should reset charges and timer on reset', () => {
    const { shield } = setup({ maxCharges: 3, rechargeCooldown: 5000 });

    shield.absorb();
    shield.absorb();
    shield.update(3000); // partial recharge progress

    shield.reset();

    expect(shield.getCharges()).toBe(3);
    expect(shield.isActive()).toBe(true);
    // After reset, timer should be cleared — update less than cooldown should not recharge
    shield.absorb();
    shield.update(2000);
    expect(shield.getCharges()).toBe(2); // no spurious recharge from old timer
  });

  it('should respond to configured damageEvent and absorb', () => {
    const { engine, shield } = setup({
      maxCharges: 3,
      damageEvent: 'collision:damage',
    });

    const blockHandler = vi.fn();
    const absorbedHandler = vi.fn();
    engine.eventBus.on('shield:block', blockHandler);
    engine.eventBus.on('shield:absorbed', absorbedHandler);

    engine.eventBus.emit('collision:damage', { targetId: 'player', amount: 10 });

    expect(shield.getCharges()).toBe(2);
    expect(blockHandler).toHaveBeenCalledOnce();
    expect(absorbedHandler).toHaveBeenCalledOnce();
  });

  it('should let damage pass through when no charges remain', () => {
    const { engine, shield } = setup({
      maxCharges: 1,
      damageEvent: 'collision:damage',
    });

    // Use the only charge via event
    engine.eventBus.emit('collision:damage', { targetId: 'player', amount: 10 });
    expect(shield.getCharges()).toBe(0);

    const passthroughHandler = vi.fn();
    engine.eventBus.on('shield:damage:passthrough', passthroughHandler);

    // Second hit — no charges, should pass through
    engine.eventBus.emit('collision:damage', { targetId: 'player', amount: 10 });
    expect(passthroughHandler).toHaveBeenCalledOnce();
  });

  it('should have correct default schema values', () => {
    const { shield } = setup();
    const params = shield.getParams();

    expect(params.maxCharges).toBe(3);
    expect(params.rechargeCooldown).toBe(5000);
    expect(params.damageEvent).toBe('collision:damage');
  });

  it('should not recharge when charges are at max and paused', () => {
    const engine = new Engine();
    const shield = new Shield('shield-1', { maxCharges: 3, rechargeCooldown: 1000 });
    engine.addModule(shield);
    // NOT emitting gameflow:resume — module stays paused

    shield.absorb();
    shield.update(2000);
    // gameflowPaused = true, so update() returns early
    expect(shield.getCharges()).toBe(2);
  });
});
