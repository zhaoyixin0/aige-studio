import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Dash } from '../mechanic/dash';

describe('Dash', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const dash = new Dash('dash-1', params);
    engine.addModule(dash);
    return { engine, dash };
  }

  it('should have correct default values', () => {
    const { dash } = setup();
    const params = dash.getParams();

    expect(params.distance).toBe(150);
    expect(params.duration).toBe(150);
    expect(params.cooldown).toBe(500);
    expect(params.triggerEvent).toBe('input:touch:doubleTap');
    expect(params.directionSource).toBe('facing');
  });

  it('should emit dash:start on trigger event', () => {
    const { engine } = setup({ triggerEvent: 'input:touch:doubleTap' });
    const handler = vi.fn();
    engine.eventBus.on('dash:start', handler);

    engine.eventBus.emit('input:touch:doubleTap');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ direction: expect.any(Object) }),
    );
  });

  it('should emit dash:end after duration elapses', () => {
    const { engine, dash } = setup({ duration: 150 });
    const endHandler = vi.fn();
    engine.eventBus.on('dash:end', endHandler);

    engine.eventBus.emit('input:touch:doubleTap');

    // Not yet expired
    dash.update(100);
    expect(endHandler).not.toHaveBeenCalled();

    // Now elapsed >= duration
    dash.update(50);
    expect(endHandler).toHaveBeenCalledOnce();
    expect(endHandler).toHaveBeenCalledWith(
      expect.objectContaining({ displacement: expect.any(Object) }),
    );
  });

  it('should block dash during cooldown', () => {
    const { engine, dash } = setup({ duration: 100, cooldown: 500 });
    const startHandler = vi.fn();
    engine.eventBus.on('dash:start', startHandler);

    // First dash
    engine.eventBus.emit('input:touch:doubleTap');
    expect(startHandler).toHaveBeenCalledTimes(1);

    // Complete the dash
    dash.update(100);

    // Try again during cooldown — should be blocked
    engine.eventBus.emit('input:touch:doubleTap');
    expect(startHandler).toHaveBeenCalledTimes(1);

    // Drain cooldown
    dash.update(500);

    // Now should work again
    engine.eventBus.emit('input:touch:doubleTap');
    expect(startHandler).toHaveBeenCalledTimes(2);
  });

  it('should compute displacement during dash', () => {
    const { engine, dash } = setup({ distance: 200, duration: 200, directionSource: 'fixed' });

    engine.eventBus.emit('input:touch:doubleTap');

    // Halfway through
    dash.update(100);
    const mid = dash.getDisplacement();
    expect(mid.x).toBeCloseTo(100, 0);
    expect(mid.y).toBeCloseTo(0, 0);

    // Complete
    dash.update(100);
    const final = dash.getDisplacement();
    expect(final.x).toBeCloseTo(200, 0);
    expect(final.y).toBeCloseTo(0, 0);
  });

  it('should report active state correctly', () => {
    const { engine, dash } = setup({ duration: 150 });

    expect(dash.isActive()).toBe(false);

    engine.eventBus.emit('input:touch:doubleTap');
    expect(dash.isActive()).toBe(true);

    dash.update(150);
    expect(dash.isActive()).toBe(false);
  });

  it('should reset state correctly', () => {
    const { engine, dash } = setup({ duration: 100, cooldown: 500 });

    engine.eventBus.emit('input:touch:doubleTap');
    dash.update(100); // complete dash, start cooldown

    expect(dash.isActive()).toBe(false);

    dash.reset();

    expect(dash.isActive()).toBe(false);
    expect(dash.getDisplacement()).toEqual({ x: 0, y: 0 });

    // After reset, cooldown should be cleared — dash should work immediately
    const startHandler = vi.fn();
    engine.eventBus.on('dash:start', startHandler);
    engine.eventBus.emit('input:touch:doubleTap');
    expect(startHandler).toHaveBeenCalledOnce();
  });
});
