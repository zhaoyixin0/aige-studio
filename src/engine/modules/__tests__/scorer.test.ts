import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Scorer } from '../mechanic/scorer';

describe('Scorer', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const scorer = new Scorer('scorer-1', params);
    engine.addModule(scorer);
    return { engine, scorer };
  }

  it('should start with score 0', () => {
    const { scorer } = setup();
    expect(scorer.getScore()).toBe(0);
  });

  it('should increase score on collision:hit event', () => {
    const { engine, scorer } = setup({ perHit: 10 });
    engine.eventBus.emit('collision:hit');
    expect(scorer.getScore()).toBe(10);
  });

  it('should track combo within time window', () => {
    const { engine, scorer } = setup({
      perHit: 10,
      combo: { enabled: true, window: 1000, multiplier: [1, 1, 1.5] },
    });

    // First hit: 10 * 1 = 10
    engine.eventBus.emit('collision:hit');
    expect(scorer.getScore()).toBe(10);

    // Second hit: 10 * 1 = 10, total = 20
    engine.eventBus.emit('collision:hit');
    expect(scorer.getScore()).toBe(20);

    // Third hit: 10 * 1.5 = 15, total = 35
    engine.eventBus.emit('collision:hit');
    expect(scorer.getScore()).toBe(35);
  });

  it('should emit scorer:update on score change', () => {
    const { engine, scorer } = setup({ perHit: 10 });
    const handler = vi.fn();
    engine.eventBus.on('scorer:update', handler);

    engine.eventBus.emit('collision:hit');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ score: 10, delta: 10, combo: 1 }),
    );
  });
});
