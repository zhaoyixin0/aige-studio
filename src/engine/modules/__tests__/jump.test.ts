import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Jump } from '../mechanic/jump';

describe('Jump', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const jump = new Jump('jump-1', params);
    engine.addModule(jump);
    return { engine, jump };
  }

  it('should start grounded at groundY', () => {
    const { jump } = setup({ groundY: 0.8 });
    expect(jump.isGrounded()).toBe(true);
    expect(jump.getY()).toBe(0.8);
  });

  it('should emit jump:start on trigger event', () => {
    const { engine } = setup({ triggerEvent: 'touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('jump:start', handler);

    engine.eventBus.emit('touch:tap');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not double-jump when already airborne', () => {
    const { engine, jump } = setup({ triggerEvent: 'touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('jump:start', handler);

    engine.eventBus.emit('touch:tap');
    engine.eventBus.emit('touch:tap');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(jump.isGrounded()).toBe(false);
  });

  it('should land after enough update ticks', () => {
    const { engine, jump } = setup({
      jumpForce: 500,
      gravity: 980,
      groundY: 0.8,
      triggerEvent: 'touch:tap',
    });
    const landHandler = vi.fn();
    engine.eventBus.on('jump:land', landHandler);

    engine.eventBus.emit('touch:tap');

    // Simulate many frames until landing
    for (let i = 0; i < 200; i++) {
      jump.update(16); // ~16ms per frame
    }

    expect(jump.isGrounded()).toBe(true);
    expect(jump.getY()).toBe(0.8);
    expect(landHandler).toHaveBeenCalled();
  });
});
