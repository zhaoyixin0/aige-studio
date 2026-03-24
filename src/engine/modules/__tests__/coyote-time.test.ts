import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CoyoteTime } from '../mechanic/coyote-time';

describe('CoyoteTime', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const coyote = new CoyoteTime('coyote-1', params);
    engine.addModule(coyote);
    engine.eventBus.emit('gameflow:resume');
    return { engine, coyote };
  }

  it('should have correct default schema values', () => {
    const coyote = new CoyoteTime('coyote-1');
    const params = coyote.getParams();

    expect(params.coyoteFrames).toBe(6);
    expect(params.bufferFrames).toBe(6);
    expect(params.jumpEvent).toBe('input:touch:tap');
  });

  it('should allow jump within coyote window after falling', () => {
    const { engine } = setup({ coyoteFrames: 6 });
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Player starts falling — coyoteTimer = 6 * 16 = 96ms
    engine.eventBus.emit('gravity:falling');

    // A little time passes (within the window)
    engine.eventBus.emit('input:touch:tap');

    expect(jumpHandler).toHaveBeenCalledOnce();
  });

  it('should block jump after coyote window expires', () => {
    const { engine, coyote } = setup({ coyoteFrames: 3 });
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Player starts falling — coyoteTimer = 3 * 16 = 48ms
    engine.eventBus.emit('gravity:falling');

    // Simulate enough time to expire the window
    coyote.update(50);

    // Try to jump after window expired
    engine.eventBus.emit('input:touch:tap');

    expect(jumpHandler).not.toHaveBeenCalled();
  });

  it('should buffer jump input and fire on landing', () => {
    const { engine, coyote } = setup({ coyoteFrames: 3, bufferFrames: 6 });
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Player starts falling
    engine.eventBus.emit('gravity:falling');

    // Coyote window expires
    coyote.update(50);

    // Jump pressed while airborne and outside coyote window — buffers
    engine.eventBus.emit('input:touch:tap');
    expect(jumpHandler).not.toHaveBeenCalled();

    // Player lands — buffered jump should fire
    engine.eventBus.emit('gravity:landed');

    expect(jumpHandler).toHaveBeenCalledOnce();
  });

  it('should block buffered jump if buffer expired', () => {
    const { engine, coyote } = setup({ coyoteFrames: 3, bufferFrames: 3 });
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Player starts falling
    engine.eventBus.emit('gravity:falling');

    // Coyote window expires
    coyote.update(50);

    // Jump pressed while airborne — buffers (bufferTimer = 3 * 16 = 48ms)
    engine.eventBus.emit('input:touch:tap');
    expect(jumpHandler).not.toHaveBeenCalled();

    // Buffer expires
    coyote.update(50);

    // Player lands — buffer has expired, should NOT fire
    engine.eventBus.emit('gravity:landed');

    expect(jumpHandler).not.toHaveBeenCalled();
  });

  it('should emit coyote:jump when grounded and jump event fires', () => {
    const { engine } = setup();
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Player is grounded by default — jump should work
    engine.eventBus.emit('input:touch:tap');

    expect(jumpHandler).toHaveBeenCalledOnce();
  });

  it('should reset all state', () => {
    const { engine, coyote } = setup({ coyoteFrames: 6 });
    const jumpHandler = vi.fn();
    engine.eventBus.on('coyote:jump', jumpHandler);

    // Trigger falling to change state
    engine.eventBus.emit('gravity:falling');

    // Reset should restore grounded state and clear timers
    coyote.reset();

    // After reset, grounded is true so jump should work
    engine.eventBus.emit('input:touch:tap');
    expect(jumpHandler).toHaveBeenCalledOnce();
  });
});
