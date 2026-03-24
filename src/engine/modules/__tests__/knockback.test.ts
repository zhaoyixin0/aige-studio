import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Knockback } from '../mechanic/knockback';

describe('Knockback', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const knockback = new Knockback('kb-1', params);
    engine.addModule(knockback);
    engine.eventBus.emit('gameflow:resume');
    return { engine, knockback };
  }

  it('should have correct default values', () => {
    const { knockback } = setup();
    const params = knockback.getParams();

    expect(params.force).toBe(300);
    expect(params.duration).toBe(200);
    expect(params.triggerEvent).toBe('collision:damage');
    expect(params.applyTo).toBe('player');
  });

  it('should emit knockback:start on trigger event', () => {
    const { engine } = setup({ triggerEvent: 'collision:damage' });
    const handler = vi.fn();
    engine.eventBus.on('knockback:start', handler);

    engine.eventBus.emit('collision:damage', { x: 0.5, y: 0.3, targetId: 'player' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ force: 300, direction: expect.any(Object) }),
    );
  });

  it('should emit knockback:end after duration elapses', () => {
    const { engine, knockback } = setup({ duration: 200 });
    const endHandler = vi.fn();
    engine.eventBus.on('knockback:end', endHandler);

    engine.eventBus.emit('collision:damage', { x: 0.5, y: 0.3 });

    // Not yet expired
    knockback.update(100);
    expect(endHandler).not.toHaveBeenCalled();

    // Now elapsed >= duration
    knockback.update(100);
    expect(endHandler).toHaveBeenCalledOnce();
  });

  it('should report active state correctly', () => {
    const { engine, knockback } = setup({ duration: 200 });

    expect(knockback.isActive()).toBe(false);

    engine.eventBus.emit('collision:damage', { x: 1, y: 0 });
    expect(knockback.isActive()).toBe(true);

    // After full duration
    knockback.update(200);
    expect(knockback.isActive()).toBe(false);
  });

  it('should reset state correctly', () => {
    const { engine, knockback } = setup({ duration: 200 });

    engine.eventBus.emit('collision:damage', { x: 1, y: 0 });
    expect(knockback.isActive()).toBe(true);

    knockback.reset();

    expect(knockback.isActive()).toBe(false);
    expect(knockback.getDirection()).toEqual({ x: 0, y: 0 });
  });
});
