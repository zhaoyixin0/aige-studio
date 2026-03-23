import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Timer } from '../mechanic/timer';

describe('Timer', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const timer = new Timer('timer-1', params);
    engine.addModule(timer);
    return { engine, timer };
  }

  it('should count down and emit timer:end at 0', () => {
    const { engine, timer } = setup({ mode: 'countdown', duration: 2 });
    const endHandler = vi.fn();
    engine.eventBus.on('timer:end', endHandler);

    // Tick 2 full seconds (2000ms)
    engine.tick(2000);

    expect(timer.getRemaining()).toBe(0);
    expect(endHandler).toHaveBeenCalledOnce();
  });

  it('should emit timer:tick every frame with remaining time', () => {
    const { engine } = setup({ mode: 'countdown', duration: 5 });
    const tickHandler = vi.fn();
    engine.eventBus.on('timer:tick', tickHandler);

    // Tick 2.5 seconds (3 frames)
    engine.tick(1000);
    engine.tick(1000);
    engine.tick(500);

    // Now emits every frame (3 calls)
    expect(tickHandler).toHaveBeenCalledTimes(3);
    // After 1s elapsed, remaining should be 4
    expect(tickHandler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ remaining: 4 }),
    );
    expect(tickHandler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ remaining: 3, elapsed: 2 }),
    );
  });

  it('should not go below zero', () => {
    const { engine, timer } = setup({ mode: 'countdown', duration: 1 });

    // Tick way past duration
    engine.tick(5000);

    expect(timer.getRemaining()).toBe(0);
    expect(timer.getElapsed()).toBe(1);
  });
});
