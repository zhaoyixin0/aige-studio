import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Projectile } from '../mechanic/projectile';

describe('Projectile', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new Projectile('proj-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  it('should fire projectile on fire event and emit projectile:fire', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('projectile:fire', handler);

    engine.eventBus.emit('input:touch:tap');

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: expect.any(String),
      x: expect.any(Number),
      y: expect.any(Number),
      dx: expect.any(Number),
      dy: expect.any(Number),
      speed: expect.any(Number),
      damage: expect.any(Number),
    });
    expect(mod.getActiveProjectiles()).toHaveLength(1);
  });

  it('should move projectiles each frame', () => {
    const { engine, mod } = setup({
      fireEvent: 'input:touch:tap',
      speed: 600,
    });

    engine.eventBus.emit('input:touch:tap');
    const before = { ...mod.getActiveProjectiles()[0] };

    // dt = 100ms, speed = 600 px/s → move 60 units
    mod.update(100);

    const after = mod.getActiveProjectiles()[0];
    // Default aimDirection is { dx: 0, dy: -1 } (upward)
    expect(after.y).toBeLessThan(before.y);
    expect(after.elapsed).toBeGreaterThan(before.elapsed);
  });

  it('should destroy projectile after lifetime expires', () => {
    const { engine, mod } = setup({
      fireEvent: 'input:touch:tap',
      lifetime: 500,
    });
    const destroyHandler = vi.fn();
    engine.eventBus.on('projectile:destroyed', destroyHandler);

    engine.eventBus.emit('input:touch:tap');
    expect(mod.getActiveProjectiles()).toHaveLength(1);

    // Tick past lifetime
    mod.update(600);

    expect(mod.getActiveProjectiles()).toHaveLength(0);
    expect(destroyHandler).toHaveBeenCalledOnce();
    expect(destroyHandler.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
  });

  it('should respect fire rate cooldown', () => {
    const { engine, mod } = setup({
      fireEvent: 'input:touch:tap',
      fireRate: 500,
    });

    engine.eventBus.emit('input:touch:tap');
    expect(mod.getActiveProjectiles()).toHaveLength(1);

    // Advance only 100ms — still in cooldown
    mod.update(100);
    engine.eventBus.emit('input:touch:tap');
    expect(mod.getActiveProjectiles()).toHaveLength(1);

    // Advance another 400ms to complete cooldown
    mod.update(400);
    engine.eventBus.emit('input:touch:tap');
    expect(mod.getActiveProjectiles()).toHaveLength(2);
  });

  it('should not exceed maxProjectiles', () => {
    const { engine, mod } = setup({
      fireEvent: 'input:touch:tap',
      fireRate: 0,
      maxProjectiles: 3,
      lifetime: 10000,
    });

    for (let i = 0; i < 10; i++) {
      mod.update(100);
      engine.eventBus.emit('input:touch:tap');
    }

    expect(mod.getActiveProjectiles().length).toBeLessThanOrEqual(3);
  });

  it('should update aim direction from aim:update event', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    engine.eventBus.emit('aim:update', { dx: 1, dy: 0 });
    engine.eventBus.emit('input:touch:tap');

    const proj = mod.getActiveProjectiles()[0];
    expect(proj.dx).toBeCloseTo(1);
    expect(proj.dy).toBeCloseTo(0);
  });

  it('should update source position from player:move event', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    engine.eventBus.emit('player:move', { x: 200, y: 400 });
    engine.eventBus.emit('input:touch:tap');

    const proj = mod.getActiveProjectiles()[0];
    expect(proj.x).toBe(200);
    expect(proj.y).toBe(400);
  });

  it('should reset all projectiles on reset', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    engine.eventBus.emit('input:touch:tap');
    expect(mod.getActiveProjectiles()).toHaveLength(1);

    mod.reset();
    expect(mod.getActiveProjectiles()).toHaveLength(0);
  });

  it('should not fire when gameflow is paused', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    engine.eventBus.emit('gameflow:pause');
    engine.eventBus.emit('input:touch:tap');

    // Manually call fire to confirm it's guarded in update too
    mod.fire();
    expect(mod.getActiveProjectiles()).toHaveLength(0);
  });

  it('should set aim direction via setAimDirection', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    mod.setAimDirection(0.707, 0.707);
    engine.eventBus.emit('input:touch:tap');

    const proj = mod.getActiveProjectiles()[0];
    expect(proj.dx).toBeCloseTo(0.707);
    expect(proj.dy).toBeCloseTo(0.707);
  });

  it('should set source position via setSourcePosition', () => {
    const { engine, mod } = setup({ fireEvent: 'input:touch:tap' });

    mod.setSourcePosition(100, 300);
    engine.eventBus.emit('input:touch:tap');

    const proj = mod.getActiveProjectiles()[0];
    expect(proj.x).toBe(100);
    expect(proj.y).toBe(300);
  });
});
