import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Lives } from '../mechanic/lives';

describe('Lives', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const lives = new Lives('lives-1', params);
    engine.addModule(lives);
    return { engine, lives };
  }

  it('should start with configured count', () => {
    const { lives } = setup({ count: 5 });
    expect(lives.getCurrent()).toBe(5);
  });

  it('should decrease on collision:damage event', () => {
    const { engine, lives } = setup({ count: 3, events: { damage: -1 } });
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(2);
  });

  it('should emit lives:zero when depleted', () => {
    const { engine, lives } = setup({ count: 1 });
    const zeroHandler = vi.fn();
    engine.eventBus.on('lives:zero', zeroHandler);

    engine.eventBus.emit('collision:damage');

    expect(lives.getCurrent()).toBe(0);
    expect(zeroHandler).toHaveBeenCalledOnce();
  });

  it('should not go below zero', () => {
    const { engine, lives } = setup({ count: 1 });

    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');

    expect(lives.getCurrent()).toBe(0);
  });
});
