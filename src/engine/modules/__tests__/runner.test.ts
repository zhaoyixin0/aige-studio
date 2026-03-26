import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Runner } from '../mechanic/runner';

describe('Runner', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const runner = new Runner('runner-1', params);
    engine.addModule(runner);
    engine.eventBus.emit('gameflow:resume');
    return { engine, runner };
  }

  it('should start in the middle lane', () => {
    const { runner } = setup({ laneCount: 3 });
    runner.start();
    expect(runner.getCurrentLane()).toBe(1); // middle of 3 lanes
  });

  it('should change lane on swipe', () => {
    const { engine, runner } = setup({ laneCount: 3 });
    const laneHandler = vi.fn();
    engine.eventBus.on('runner:laneChange', laneHandler);

    runner.start();

    engine.eventBus.emit('input:touch:swipe', { direction: 'left' });

    expect(runner.getCurrentLane()).toBe(0);
    expect(laneHandler).toHaveBeenCalledWith(
      expect.objectContaining({ from: 1, to: 0 }),
    );
  });

  it('should not move past lane boundaries', () => {
    const { engine, runner } = setup({ laneCount: 3 });

    runner.start();

    // Swipe left twice from middle (lane 1) — should stop at 0
    engine.eventBus.emit('input:touch:swipe', { direction: 'left' });
    engine.eventBus.emit('input:touch:swipe', { direction: 'left' });

    expect(runner.getCurrentLane()).toBe(0);
  });

  it('should accumulate distance over time', () => {
    const { runner } = setup({ speed: 300, acceleration: 0 });
    runner.start();

    runner.update(1000); // 1 second at 300 units/s
    expect(runner.getDistance()).toBeCloseTo(300, 0);
  });

  it('should accelerate speed over time', () => {
    const { runner } = setup({ speed: 100, acceleration: 50 });
    runner.start();

    runner.update(1000); // 1 second
    expect(runner.getCurrentSpeed()).toBeCloseTo(150, 0);
  });

  it('should cap speed at maxSpeed', () => {
    const { runner } = setup({ speed: 100, acceleration: 100, maxSpeed: 200 });
    runner.start();

    // After 5 seconds: 100 + 100*5 = 600, but should be capped at 200
    for (let i = 0; i < 5; i++) runner.update(1000);

    expect(runner.getCurrentSpeed()).toBe(200);
  });

  it('should use default maxSpeed when not configured', () => {
    const { runner } = setup({ speed: 100, acceleration: 100 });
    runner.start();

    // After 20 seconds: 100 + 100*20 = 2100, should be capped at default maxSpeed
    for (let i = 0; i < 20; i++) runner.update(1000);

    // Default maxSpeed should be a reasonable limit (e.g., 3x initial speed or 1500)
    expect(runner.getCurrentSpeed()).toBeLessThanOrEqual(1500);
  });
});
