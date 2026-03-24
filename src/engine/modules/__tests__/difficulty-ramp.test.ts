import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core';
import { DifficultyRamp } from '../mechanic/difficulty-ramp';
import { Spawner } from '../mechanic/spawner';

describe('DifficultyRamp', () => {
  function setup(rampParams: Record<string, any> = {}) {
    const engine = new Engine();

    // Target module: a Spawner whose speed we want to ramp
    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      speed: { min: 100, max: 200 },
      frequency: 2,
      spawnArea: { x: 0, y: 0, width: 800, height: 0 },
      direction: 'down',
      maxCount: 10,
    });
    engine.addModule(spawner);

    const ramp = new DifficultyRamp('ramp-1', {
      target: 'spawner-1',
      rules: [
        { every: 5, field: 'frequency', decrease: 0.2, min: 0.5, max: 10 },
      ],
      mode: 'time',
      ...rampParams,
    });
    engine.addModule(ramp);

    engine.eventBus.emit('gameflow:resume');
    return { engine, spawner, ramp };
  }

  it('should adjust target module param after configured interval', () => {
    const { engine, spawner } = setup({
      rules: [
        { every: 5, field: 'frequency', decrease: 0.2, min: 0.5, max: 10 },
      ],
    });

    // frequency starts at 2
    expect(spawner.getParams().frequency).toBe(2);

    // Tick 5 seconds (5000ms)
    engine.tick(5000);

    // frequency should have decreased by 0.2 => 1.8
    expect(spawner.getParams().frequency).toBeCloseTo(1.8);
  });

  it('should respect max bounds and not exceed configured max', () => {
    const { engine, spawner } = setup({
      rules: [
        { every: 1, field: 'frequency', increase: 5, min: 0, max: 10 },
      ],
    });

    // frequency starts at 2. increase by 5 every second.
    // After 1s: 7, after 2s: 10 (capped), after 3s: still 10
    engine.tick(1000);
    expect(spawner.getParams().frequency).toBeCloseTo(7);

    engine.tick(1000);
    expect(spawner.getParams().frequency).toBeCloseTo(10);

    engine.tick(1000);
    // Should still be 10, not 15
    expect(spawner.getParams().frequency).toBeCloseTo(10);
  });
});
