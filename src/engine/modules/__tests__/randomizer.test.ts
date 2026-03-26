import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Randomizer } from '../mechanic/randomizer';

describe('Randomizer', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
        { asset: 'prize-b', label: 'Prize B', weight: 1 },
        { asset: 'prize-c', label: 'Prize C', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 1, // 1 second
      trigger: 'tap',
      ...params,
    });
    engine.addModule(randomizer);
    engine.eventBus.emit('gameflow:resume');
    return { engine, randomizer };
  }

  it('should spin and emit randomizer:result with selected item', () => {
    const { engine, randomizer } = setup({ spinDuration: 1 });
    const resultHandler = vi.fn();
    engine.eventBus.on('randomizer:result', resultHandler);

    randomizer.spin();
    expect(randomizer.isSpinning()).toBe(true);

    // Advance past spin duration
    engine.tick(1100);

    expect(randomizer.isSpinning()).toBe(false);
    expect(resultHandler).toHaveBeenCalledOnce();

    const result = resultHandler.mock.calls[0][0];
    expect(result).toHaveProperty('item');
    expect(result).toHaveProperty('index');
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThan(3);
  });

  it('should respect weights (high weight item selected more often)', () => {
    const { engine, randomizer } = setup({
      items: [
        { asset: 'common', label: 'Common', weight: 100 },
        { asset: 'rare', label: 'Rare', weight: 1 },
      ],
      spinDuration: 0.1, // fast spins for testing
    });

    const results: number[] = [];
    engine.eventBus.on('randomizer:result', (data: any) => {
      results.push(data.index);
    });

    // Run many spins
    for (let i = 0; i < 200; i++) {
      randomizer.spin();
      engine.tick(200); // past spinDuration
    }

    const commonCount = results.filter((i) => i === 0).length;
    const rareCount = results.filter((i) => i === 1).length;

    // Common (weight 100) should be selected far more often than Rare (weight 1)
    expect(commonCount).toBeGreaterThan(rareCount * 5);
  });

  it('should auto-spin on gameflow:resume when trigger is auto', () => {
    // Build without auto gameflow:resume so we can attach spy first
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
        { asset: 'prize-b', label: 'Prize B', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 0.5,
      trigger: 'auto',
    });
    engine.addModule(randomizer);

    const spinHandler = vi.fn();
    engine.eventBus.on('randomizer:spinning', spinHandler);

    // Now emit gameflow:resume — should trigger auto-spin
    engine.eventBus.emit('gameflow:resume');

    expect(spinHandler).toHaveBeenCalledOnce();
    expect(randomizer.isSpinning()).toBe(true);
  });

  it('should not advance spin timer when gameflow is paused', () => {
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 1,
      trigger: 'tap',
    });
    engine.addModule(randomizer);
    // Do NOT emit gameflow:resume — module stays paused

    randomizer.spin();
    expect(randomizer.isSpinning()).toBe(true);

    // Timer should not advance while paused
    randomizer.update(2000);
    expect(randomizer.isSpinning()).toBe(true); // still spinning, not resolved
  });

  it('should auto-spin again after result in auto mode', () => {
    const { engine, randomizer } = setup({ trigger: 'auto', spinDuration: 0.5 });
    const resultHandler = vi.fn();
    engine.eventBus.on('randomizer:result', resultHandler);

    // Already spinning from setup's gameflow:resume
    expect(randomizer.isSpinning()).toBe(true);

    // Complete first spin — deferred auto-spin fires in same tick
    engine.tick(600);
    expect(resultHandler).toHaveBeenCalledOnce();

    // Should already be spinning again (deferred auto-spin)
    expect(randomizer.isSpinning()).toBe(true);

    // Complete second spin
    engine.tick(600);
    expect(resultHandler).toHaveBeenCalledTimes(2);
  });
});
