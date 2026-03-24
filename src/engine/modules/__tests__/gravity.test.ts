import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Gravity } from '../mechanic/gravity';

describe('Gravity', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const gravity = new Gravity('gravity-1', params);
    engine.addModule(gravity);
    engine.eventBus.emit('gameflow:resume');
    return { engine, gravity };
  }

  it('should have correct default schema values', () => {
    const gravity = new Gravity('gravity-1');
    const params = gravity.getParams();

    expect(params.strength).toBe(980);
    expect(params.terminalVelocity).toBe(800);
    expect(params.applyTo).toBe('player');
    expect(params.toggleEvent).toBe('');
  });

  it('should apply downward velocity to airborne objects', () => {
    const { gravity } = setup({ strength: 980 });

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    // One update at 16ms
    gravity.update(16);

    const obj = gravity.getObject('player-1');
    expect(obj).toBeDefined();
    // velocityY should have increased: strength * dtSec = 980 * 0.016 = 15.68
    expect(obj!.velocityY).toBeGreaterThan(0);
    // y should have moved down
    expect(obj!.y).toBeGreaterThan(0.2);
  });

  it('should cap velocity at terminal velocity', () => {
    const { gravity } = setup({ strength: 2000, terminalVelocity: 100 });

    gravity.addObject('player-1', { x: 0.5, y: 0.1, floorY: 0.9, airborne: true });

    // Many updates to exceed terminal velocity
    for (let i = 0; i < 100; i++) {
      gravity.update(16);
    }

    const obj = gravity.getObject('player-1');
    // If object already landed, velocityY would be 0, so check while still falling
    // Instead, add an object with a very far floor
    const { gravity: g2 } = setup({ strength: 2000, terminalVelocity: 100 });
    g2.addObject('p2', { x: 0.5, y: 0, floorY: 99999, airborne: true });

    for (let i = 0; i < 100; i++) {
      g2.update(16);
    }

    const obj2 = g2.getObject('p2');
    expect(obj2).toBeDefined();
    expect(obj2!.velocityY).toBeLessThanOrEqual(100);
  });

  it('should emit gravity:landed when object reaches floorY', () => {
    const { engine, gravity } = setup({ strength: 980 });
    const landHandler = vi.fn();
    engine.eventBus.on('gravity:landed', landHandler);

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    // Simulate enough frames to land
    for (let i = 0; i < 200; i++) {
      gravity.update(16);
    }

    expect(landHandler).toHaveBeenCalled();
    expect(landHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'player-1', y: 0.8 }),
    );

    const obj = gravity.getObject('player-1');
    expect(obj!.airborne).toBe(false);
    expect(obj!.y).toBe(0.8);
  });

  it('should emit gravity:falling when object starts falling', () => {
    const { engine, gravity } = setup({ strength: 980 });
    const fallingHandler = vi.fn();
    engine.eventBus.on('gravity:falling', fallingHandler);

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    gravity.update(16);

    expect(fallingHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'player-1' }),
    );
  });

  it('should mark object airborne on jump:start event', () => {
    const { engine, gravity } = setup();

    gravity.addObject('player-1', { x: 0.5, y: 0.8, floorY: 0.8, airborne: false });

    expect(gravity.getObject('player-1')!.airborne).toBe(false);

    engine.eventBus.emit('jump:start', { id: 'player-1' });

    expect(gravity.getObject('player-1')!.airborne).toBe(true);
  });

  it('should toggle gravity on/off when toggleEvent is set', () => {
    const { engine, gravity } = setup({ toggleEvent: 'gravity:toggle' });

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    // Toggle off
    engine.eventBus.emit('gravity:toggle');

    // Update should not affect the object
    const yBefore = gravity.getObject('player-1')!.y;
    gravity.update(16);
    const yAfter = gravity.getObject('player-1')!.y;

    expect(yAfter).toBe(yBefore);

    // Toggle back on
    engine.eventBus.emit('gravity:toggle');

    gravity.update(16);
    const yAfterReEnable = gravity.getObject('player-1')!.y;
    expect(yAfterReEnable).toBeGreaterThan(yBefore);
  });

  it('should clear all objects on reset', () => {
    const { gravity } = setup();

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });
    gravity.addObject('player-2', { x: 0.3, y: 0.4, floorY: 0.9, airborne: false });

    expect(gravity.getObject('player-1')).toBeDefined();
    expect(gravity.getObject('player-2')).toBeDefined();

    gravity.reset();

    expect(gravity.getObject('player-1')).toBeUndefined();
    expect(gravity.getObject('player-2')).toBeUndefined();
  });
});
