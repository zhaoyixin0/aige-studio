import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { IFrames } from '../mechanic/i-frames';

describe('IFrames', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const iframes = new IFrames('iframes-1', params);
    engine.addModule(iframes);
    return { engine, iframes };
  }

  it('should have correct default values', () => {
    const { iframes } = setup();
    const params = iframes.getParams();

    expect(params.duration).toBe(1000);
    expect(params.triggerEvent).toBe('collision:damage');
    expect(params.flashEffect).toBe(true);
    expect(iframes.isActive()).toBe(false);
  });

  it('should activate on trigger event', () => {
    const { engine, iframes } = setup();
    const startHandler = vi.fn();
    engine.eventBus.on('iframes:start', startHandler);

    engine.eventBus.emit('collision:damage');

    expect(iframes.isActive()).toBe(true);
    expect(startHandler).toHaveBeenCalledOnce();
    expect(startHandler).toHaveBeenCalledWith({ duration: 1000 });
  });

  it('should deactivate after duration elapses', () => {
    const { engine, iframes } = setup({ duration: 500 });
    const endHandler = vi.fn();
    engine.eventBus.on('iframes:end', endHandler);

    engine.eventBus.emit('collision:damage');
    expect(iframes.isActive()).toBe(true);

    // Partially elapsed — still active
    iframes.update(300);
    expect(iframes.isActive()).toBe(true);

    // Fully elapsed — deactivated
    iframes.update(200);
    expect(iframes.isActive()).toBe(false);
    expect(endHandler).toHaveBeenCalledOnce();
  });

  it('should NOT re-trigger while already active', () => {
    const { engine, iframes } = setup({ duration: 1000 });
    const startHandler = vi.fn();
    engine.eventBus.on('iframes:start', startHandler);

    engine.eventBus.emit('collision:damage');
    expect(startHandler).toHaveBeenCalledTimes(1);

    // Try to trigger again while active
    engine.eventBus.emit('collision:damage');
    expect(startHandler).toHaveBeenCalledTimes(1);
  });

  it('should use custom triggerEvent', () => {
    const { engine, iframes } = setup({ triggerEvent: 'player:hit' });

    // Default event should not activate
    engine.eventBus.emit('collision:damage');
    expect(iframes.isActive()).toBe(false);

    // Custom event should activate
    engine.eventBus.emit('player:hit');
    expect(iframes.isActive()).toBe(true);
  });

  it('should reset state', () => {
    const { engine, iframes } = setup();

    engine.eventBus.emit('collision:damage');
    expect(iframes.isActive()).toBe(true);

    iframes.reset();
    expect(iframes.isActive()).toBe(false);
  });
});
