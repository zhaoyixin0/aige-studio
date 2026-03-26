import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Aim } from '../mechanic/aim';

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  const mod = new Aim('aim-1', params);
  engine.addModule(mod);
  engine.eventBus.emit('gameflow:resume');
  return { engine, mod };
}

describe('Aim', () => {
  it('should default to upward aim direction', () => {
    const { mod } = setup();
    const dir = mod.getAimDirection();
    expect(dir.dx).toBe(0);
    expect(dir.dy).toBe(-1);
  });

  it('should emit aim:update each frame in auto mode even without targets', () => {
    const { engine } = setup({ mode: 'auto' });
    const handler = vi.fn();
    engine.eventBus.on('aim:update', handler);

    engine.tick(16);

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0] as { dx: number; dy: number };
    expect(typeof payload.dx).toBe('number');
    expect(typeof payload.dy).toBe('number');
  });

  it('should update aim direction from manual input event', () => {
    const { engine, mod } = setup({ mode: 'manual', manualEvent: 'input:touch:hold' });

    // Player at center (default), touch at top-center → should aim up
    engine.eventBus.emit('player:move', { x: 400, y: 300 });
    engine.eventBus.emit('input:touch:hold', { x: 400, y: 100 });

    const dir = mod.getAimDirection();
    expect(dir.dy).toBeLessThan(0); // pointing up
    expect(dir.dx).toBeCloseTo(0, 1);
  });

  it('should reset to default aim direction on reset', () => {
    const { engine, mod } = setup({ mode: 'manual', manualEvent: 'input:touch:hold' });

    engine.eventBus.emit('player:move', { x: 400, y: 300 });
    engine.eventBus.emit('input:touch:hold', { x: 700, y: 500 });

    // Verify direction changed
    const before = mod.getAimDirection();
    expect(before.dx).not.toBeCloseTo(0, 1);

    mod.reset();

    const after = mod.getAimDirection();
    expect(after.dx).toBe(0);
    expect(after.dy).toBe(-1);
  });

  it('should track player position from player:move events', () => {
    const { engine, mod } = setup({ mode: 'manual', manualEvent: 'input:touch:hold' });

    engine.eventBus.emit('player:move', { x: 100, y: 100 });
    // Touch at same x, below player → should aim down
    engine.eventBus.emit('input:touch:hold', { x: 100, y: 300 });

    const dir = mod.getAimDirection();
    expect(dir.dy).toBeGreaterThan(0);
    expect(dir.dx).toBeCloseTo(0, 1);
  });

  it('should set targetId to null when no target found in auto mode', () => {
    const { engine, mod } = setup({ mode: 'auto' });
    engine.tick(16);
    const dir = mod.getAimDirection();
    expect(dir).toHaveProperty('dx');
    // No collision module → targetId should be null
    expect(mod['targetId']).toBeNull();
  });
});
