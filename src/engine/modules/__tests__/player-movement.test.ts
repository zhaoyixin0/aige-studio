import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { PlayerMovement } from '../mechanic/player-movement';

describe('PlayerMovement', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const pm = new PlayerMovement('pm-1', params);
    engine.addModule(pm);
    return { engine, pm };
  }

  it('should have correct default values', () => {
    const { pm } = setup();
    const params = pm.getParams();
    expect(params.speed).toBe(300);
    expect(params.acceleration).toBe(1000);
    expect(params.deceleration).toBe(800);
    expect(params.moveLeftEvent).toBe('input:touch:swipe:left');
    expect(params.moveRightEvent).toBe('input:touch:swipe:right');
    expect(pm.getX()).toBe(0);
    expect(pm.getVelocityX()).toBe(0);
  });

  it('should move right on moveRightEvent', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });
    const moveHandler = vi.fn();
    engine.eventBus.on('player:move', moveHandler);

    engine.eventBus.emit('input:touch:swipe:right');

    // Simulate one frame at 100ms
    pm.update(100);

    expect(pm.getVelocityX()).toBeGreaterThan(0);
    expect(pm.getX()).toBeGreaterThan(0);
    expect(moveHandler).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 1 }),
    );
  });

  it('should move left on moveLeftEvent', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });
    const moveHandler = vi.fn();
    engine.eventBus.on('player:move', moveHandler);

    engine.eventBus.emit('input:touch:swipe:left');

    pm.update(100);

    expect(pm.getVelocityX()).toBeLessThan(0);
    expect(pm.getX()).toBeLessThan(0);
    expect(moveHandler).toHaveBeenCalledWith(
      expect.objectContaining({ direction: -1 }),
    );
  });

  it('should decelerate to stop when input is not active', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 1000,
      deceleration: 800,
    });

    // Start moving right
    engine.eventBus.emit('input:touch:swipe:right');
    pm.update(100); // accelerate for 100ms
    expect(pm.getVelocityX()).toBeGreaterThan(0);

    // Now emit another right event to keep inputActive, then stop
    // The inputActive flag should be cleared each frame after processing
    // Actually based on spec, inputActive stays true until no new input
    // We need to simulate: after the initial event, no further input => decelerate

    // Save velocity after acceleration
    const velAfterAccel = pm.getVelocityX();

    // Update again - inputActive should have been consumed, now decelerating
    pm.update(100);

    // Velocity should be less than after acceleration (decelerating)
    expect(pm.getVelocityX()).toBeLessThan(velAfterAccel);
  });

  it('should emit player:stop when velocity reaches 0', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 10000, // fast accel to get moving
      deceleration: 10000, // fast decel to stop quickly
    });
    const stopHandler = vi.fn();
    engine.eventBus.on('player:stop', stopHandler);

    // Start moving right
    engine.eventBus.emit('input:touch:swipe:right');
    pm.update(50); // short burst of acceleration

    // Now let it decelerate for many frames until stopped
    for (let i = 0; i < 100; i++) {
      pm.update(16);
    }

    expect(stopHandler).toHaveBeenCalled();
    expect(pm.getVelocityX()).toBe(0);
  });

  it('should cap at max speed', () => {
    const { engine, pm } = setup({
      speed: 300,
      acceleration: 100000, // extremely high acceleration
    });

    // Start moving right
    engine.eventBus.emit('input:touch:swipe:right');

    // Multiple large updates to try to exceed speed cap
    pm.update(1000);
    pm.update(1000);

    // Velocity should not exceed max speed
    expect(Math.abs(pm.getVelocityX())).toBeLessThanOrEqual(300);
  });

  it('should support continuous event', () => {
    const { engine, pm } = setup({
      continuousEvent: 'input:face:position',
    });

    // Load a config with canvas width for normalization
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 800, height: 600 },
      modules: [],
      assets: {},
    });

    // Emit continuous event with normalized x
    engine.eventBus.emit('input:face:position', { x: 0.5 });

    expect(pm.getX()).toBe(400); // 0.5 * 800
  });

  it('should reset state correctly', () => {
    const { engine, pm } = setup({ speed: 300, acceleration: 1000 });

    // Move first
    engine.eventBus.emit('input:touch:swipe:right');
    pm.update(100);
    expect(pm.getX()).not.toBe(0);
    expect(pm.getVelocityX()).not.toBe(0);

    // Reset
    pm.reset();
    expect(pm.getX()).toBe(0);
    expect(pm.getVelocityX()).toBe(0);
  });
});
