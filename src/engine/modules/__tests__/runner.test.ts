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
});
