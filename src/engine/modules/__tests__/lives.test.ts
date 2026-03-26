import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Lives } from '../mechanic/lives';
import { PowerUp } from '../mechanic/power-up';

describe('Lives', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const lives = new Lives('lives-1', params);
    engine.addModule(lives);
    return { engine, lives };
  }

  it('should start with configured count', () => {
    const { lives } = setup({ count: 5 });
    expect(lives.getCurrent()).toBe(5);
  });

  it('should decrease on collision:damage event', () => {
    const { engine, lives } = setup({ count: 3, events: { damage: -1 } });
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(2);
  });

  it('should emit lives:zero when depleted', () => {
    const { engine, lives } = setup({ count: 1 });
    const zeroHandler = vi.fn();
    engine.eventBus.on('lives:zero', zeroHandler);

    engine.eventBus.emit('collision:damage');

    expect(lives.getCurrent()).toBe(0);
    expect(zeroHandler).toHaveBeenCalledOnce();
  });

  it('should not go below zero', () => {
    const { engine, lives } = setup({ count: 1 });

    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');

    expect(lives.getCurrent()).toBe(0);
  });

  it('should not take damage when PowerUp shield is active', () => {
    const engine = new Engine();
    const lives = new Lives('lives-1', { count: 3 });
    const powerUp = new PowerUp('pu-1', {
      powerUpTypes: [{ type: 'shield', duration: 5000 }],
    });
    engine.addModule(lives);
    engine.addModule(powerUp);

    // Activate shield
    powerUp.activate('shield', 5000);
    expect(powerUp.isActive('shield')).toBe(true);

    // Damage should be blocked by shield
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(3);
  });

  it('should take damage after PowerUp shield expires', () => {
    const engine = new Engine();
    const lives = new Lives('lives-1', { count: 3 });
    const powerUp = new PowerUp('pu-1', {
      powerUpTypes: [{ type: 'shield', duration: 100 }],
    });
    engine.addModule(lives);
    engine.addModule(powerUp);
    engine.eventBus.emit('gameflow:resume');

    // Activate shield then let it expire
    powerUp.activate('shield', 100);
    engine.tick(200);
    expect(powerUp.isActive('shield')).toBe(false);

    // Damage should now work
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(2);
  });
});
