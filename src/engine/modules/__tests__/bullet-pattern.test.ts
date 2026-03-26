import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { BulletPattern } from '../mechanic/bullet-pattern';

describe('BulletPattern', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new BulletPattern('bp-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  it('should return single direction for single pattern', () => {
    const { mod } = setup({ pattern: 'single' });

    const dirs = mod.calculateDirections(0, -1);

    expect(dirs).toHaveLength(1);
    expect(dirs[0]).toMatchObject({ dx: 0, dy: -1 });
  });

  it('should calculate spread directions evenly across angle', () => {
    const { mod } = setup({
      pattern: 'spread',
      bulletCount: 3,
      spreadAngle: 90,
    });

    const dirs = mod.calculateDirections(0, -1);

    expect(dirs).toHaveLength(3);
    // All directions should be unit vectors
    for (const { dx, dy } of dirs) {
      const len = Math.sqrt(dx * dx + dy * dy);
      expect(len).toBeCloseTo(1, 3);
    }
    // Middle direction should match base (0, -1)
    expect(dirs[1].dx).toBeCloseTo(0, 2);
    expect(dirs[1].dy).toBeCloseTo(-1, 2);
  });

  it('should rotate direction for spiral pattern', () => {
    const { mod } = setup({
      pattern: 'spiral',
      spiralSpeed: 90,
    });

    const dirs1 = mod.calculateDirections(0, -1);
    expect(dirs1).toHaveLength(1);

    // After first call, spiralAngle increases — simulate dt via update
    mod.update(1000); // 1 second → 90 degrees rotated
    const dirs2 = mod.calculateDirections(0, -1);

    // After 90 degrees rotation, (0,-1) rotated 90° → (1, 0) or similar
    // The directions should differ from the first call
    expect(dirs2[0].dx).not.toBeCloseTo(dirs1[0].dx, 1);
  });

  it('should queue burst fires over time', () => {
    const { engine, mod } = setup({
      pattern: 'burst',
      bulletCount: 3,
      burstDelay: 100,
    });
    const handler = vi.fn();
    engine.eventBus.on('bulletpattern:fire', handler);

    // Trigger via projectile:fire event
    engine.eventBus.emit('projectile:fire', { id: 'p1', x: 0, y: 0, dx: 0, dy: -1, speed: 600, damage: 10 });

    // First burst fires immediately
    expect(handler).toHaveBeenCalledTimes(1);

    // After 100ms, second burst
    mod.update(100);
    expect(handler).toHaveBeenCalledTimes(2);

    // After another 100ms, third burst
    mod.update(100);
    expect(handler).toHaveBeenCalledTimes(3);

    // No more after queue exhausted
    mod.update(200);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should generate random directions within spread angle', () => {
    const { mod } = setup({
      pattern: 'random',
      bulletCount: 5,
      spreadAngle: 60,
    });

    const dirs = mod.calculateDirections(0, -1);

    expect(dirs).toHaveLength(5);
    for (const { dx, dy } of dirs) {
      const len = Math.sqrt(dx * dx + dy * dy);
      expect(len).toBeCloseTo(1, 3);
    }
  });

  it('should reset spiral angle and burst queue on reset', () => {
    const { engine, mod } = setup({
      pattern: 'burst',
      bulletCount: 5,
      burstDelay: 50,
    });

    // Start a burst
    engine.eventBus.emit('projectile:fire', { id: 'p1', x: 0, y: 0, dx: 0, dy: -1, speed: 600, damage: 10 });
    mod.update(50); // process one

    mod.reset();

    // After reset, burst queue should be cleared (no pending fires)
    const handler = vi.fn();
    engine.eventBus.on('bulletpattern:fire', handler);
    mod.update(500); // should not emit anything from old burst
    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit bulletpattern:fire with directions on projectile:fire event', () => {
    const { engine } = setup({
      pattern: 'spread',
      bulletCount: 3,
      spreadAngle: 60,
    });
    const handler = vi.fn();
    engine.eventBus.on('bulletpattern:fire', handler);

    engine.eventBus.emit('projectile:fire', { id: 'p1', x: 0, y: 0, dx: 0, dy: -1, speed: 600, damage: 10 });

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload).toMatchObject({
      directions: expect.arrayContaining([
        expect.objectContaining({ dx: expect.any(Number), dy: expect.any(Number) }),
      ]),
    });
    expect(payload.directions).toHaveLength(3);
  });

  it('should not process events when gameflow is paused', () => {
    const { engine, mod } = setup({ pattern: 'burst', bulletCount: 3, burstDelay: 50 });

    engine.eventBus.emit('gameflow:pause');
    const handler = vi.fn();
    engine.eventBus.on('bulletpattern:fire', handler);

    // Burst timer should not decrement while paused
    engine.eventBus.emit('projectile:fire', { id: 'p1', x: 0, y: 0, dx: 0, dy: -1, speed: 600, damage: 10 });
    mod.update(200);

    // The initial event listener fires regardless of pause, but update-based burst should not
    // The listener itself fires on event, not in update — so burst update path is paused
    // Reset and verify update doesn't process burst when paused
    mod.reset();
    engine.eventBus.emit('gameflow:pause');
    handler.mockClear();

    // Manually queue a burst by temporarily resuming, firing, then pausing
    engine.eventBus.emit('gameflow:resume');
    engine.eventBus.emit('projectile:fire', { id: 'p2', x: 0, y: 0, dx: 0, dy: -1, speed: 600, damage: 10 });
    engine.eventBus.emit('gameflow:pause');
    handler.mockClear();

    mod.update(200); // paused — burst should not advance
    expect(handler).not.toHaveBeenCalled();
  });
});
