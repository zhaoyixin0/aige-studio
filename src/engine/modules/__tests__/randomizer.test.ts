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
});
