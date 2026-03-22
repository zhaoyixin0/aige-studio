import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { ComboSystem } from '../mechanic/combo-system';

describe('ComboSystem', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const combo = new ComboSystem('combo-1', params);
    engine.addModule(combo);
    return { engine, combo };
  }

  it('should emit combo:hit on scorer:update', () => {
    const { engine } = setup();
    const handler = vi.fn();
    engine.eventBus.on('combo:hit', handler);

    engine.eventBus.emit('scorer:update', { score: 10 });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, multiplier: 1 }),
    );
  });

  it('should increase combo count on consecutive hits', () => {
    const { engine, combo } = setup({ comboWindow: 99999 });
    const handler = vi.fn();
    engine.eventBus.on('combo:hit', handler);

    engine.eventBus.emit('scorer:update', { score: 10 });
    engine.eventBus.emit('scorer:update', { score: 20 });
    engine.eventBus.emit('scorer:update', { score: 30 });

    expect(combo.getComboCount()).toBe(3);
    expect(handler).toHaveBeenCalledTimes(3);
    // Third call should have count=3, multiplier=1+2*0.5=2
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({ count: 3, multiplier: 2 }),
    );
  });

  it('should cap multiplier at maxMultiplier', () => {
    const { engine, combo } = setup({
      comboWindow: 99999,
      multiplierStep: 1,
      maxMultiplier: 3,
    });

    // Hit 5 times — multiplier should be capped at 3
    for (let i = 0; i < 5; i++) {
      engine.eventBus.emit('scorer:update', { score: i * 10 });
    }

    expect(combo.getMultiplier()).toBe(3);
  });
});
