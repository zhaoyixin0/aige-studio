import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { PowerUp } from '../mechanic/power-up';

describe('PowerUp', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const powerUp = new PowerUp('pu-1', params);
    engine.addModule(powerUp);
    engine.eventBus.emit('gameflow:resume');
    return { engine, powerUp };
  }

  it('should activate a power-up via activate()', () => {
    const { engine, powerUp } = setup();
    const handler = vi.fn();
    engine.eventBus.on('powerup:activate', handler);

    powerUp.activate('speed', 5000, 2);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'speed', duration: 5000, multiplier: 2 }),
    );
    expect(powerUp.isActive('speed')).toBe(true);
  });

  it('should expire power-up after duration', () => {
    const { engine, powerUp } = setup();
    const expireHandler = vi.fn();
    engine.eventBus.on('powerup:expire', expireHandler);

    powerUp.activate('shield', 1000);

    // Simulate time passing
    powerUp.update(500);
    expect(powerUp.isActive('shield')).toBe(true);

    powerUp.update(600);
    expect(powerUp.isActive('shield')).toBe(false);
    expect(expireHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'shield' }),
    );
  });

  it('should replace existing power-up of same type', () => {
    const { powerUp } = setup();

    powerUp.activate('speed', 5000, 2);
    powerUp.activate('speed', 3000, 3);

    const active = powerUp.getActivePowerUps();
    expect(active).toHaveLength(1);
    expect(active[0].duration).toBe(3000);
  });

  it('should handle invalid duration gracefully', () => {
    const { powerUp } = setup();

    // NaN duration should not crash or create invalid state
    powerUp.activate('speed', NaN);
    expect(powerUp.isActive('speed')).toBe(false);

    // Zero duration should not activate
    powerUp.activate('speed', 0);
    expect(powerUp.isActive('speed')).toBe(false);

    // Negative duration should not activate
    powerUp.activate('speed', -100);
    expect(powerUp.isActive('speed')).toBe(false);
  });
});
