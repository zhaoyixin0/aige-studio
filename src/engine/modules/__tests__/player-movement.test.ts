import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { PlayerMovement } from '../mechanic/player-movement';

describe('PlayerMovement', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const pm = new PlayerMovement('pm-1', params);
    engine.addModule(pm);
    engine.eventBus.emit('gameflow:resume');
    return { engine, pm };
  }

  it('should have correct default values', () => {
    const { pm } = setup();
    expect(pm.getX()).toBe(0);
    expect(pm.getVelocityX()).toBe(0);
  });

  it('should move right on touch hold right', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });
    const moveHandler = vi.fn();
    engine.eventBus.on('player:move', moveHandler);

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    pm.update(100);

    expect(pm.getVelocityX()).toBeGreaterThan(0);
    expect(pm.getX()).toBeGreaterThan(0);
    expect(moveHandler).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 1 }),
    );
  });

  it('should move left on touch hold left', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });
    const moveHandler = vi.fn();
    engine.eventBus.on('player:move', moveHandler);

    engine.eventBus.emit('input:touch:hold', { side: 'left' });
    pm.update(100);

    expect(pm.getVelocityX()).toBeLessThan(0);
    expect(pm.getX()).toBeLessThan(0);
    expect(moveHandler).toHaveBeenCalledWith(
      expect.objectContaining({ direction: -1 }),
    );
  });

  it('should decelerate to stop after release', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 1000,
      deceleration: 800,
    });

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    pm.update(100);
    expect(pm.getVelocityX()).toBeGreaterThan(0);

    // Release input
    engine.eventBus.emit('input:touch:release', {});
    const velAfterRelease = pm.getVelocityX();

    pm.update(100);
    expect(pm.getVelocityX()).toBeLessThan(velAfterRelease);
  });

  it('should emit player:stop when velocity reaches 0', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 10000,
      deceleration: 10000,
    });
    const stopHandler = vi.fn();
    engine.eventBus.on('player:stop', stopHandler);

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    pm.update(50);

    engine.eventBus.emit('input:touch:release', {});
    for (let i = 0; i < 100; i++) {
      pm.update(16);
    }

    expect(stopHandler).toHaveBeenCalled();
    expect(pm.getVelocityX()).toBe(0);
  });

  it('should cap at max speed', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 100000,
    });

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    pm.update(1000);
    pm.update(1000);

    expect(Math.abs(pm.getVelocityX())).toBeLessThanOrEqual(300);
  });

  it('should support continuous event', () => {
    const { engine, pm } = setup({
      continuousEvent: 'input:face:position',
    });

    engine.loadConfig({
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 800, height: 600 },
      modules: [],
      assets: {},
    });

    engine.eventBus.emit('input:face:position', { x: 0.5 });
    expect(pm.getX()).toBe(400);
  });

  it('should reset state correctly', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    pm.update(100);
    expect(pm.getX()).not.toBe(0);
    expect(pm.getVelocityX()).not.toBe(0);

    pm.reset();
    expect(pm.getX()).toBe(0);
    expect(pm.getVelocityX()).toBe(0);
  });

  it('should move on swipe events', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });

    engine.eventBus.emit('input:touch:swipe', { direction: 'right' });
    pm.update(100);

    expect(pm.getVelocityX()).toBeGreaterThan(0);
  });
});
