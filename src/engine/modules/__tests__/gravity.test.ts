import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Gravity, type PlatformSurface } from '../mechanic/gravity';

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

  it('should emit gravity:falling only once when object becomes airborne', () => {
    const { engine, gravity } = setup({ strength: 980 });
    const fallingHandler = vi.fn();
    engine.eventBus.on('gravity:falling', fallingHandler);

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 99999, airborne: true });

    // Multiple update frames
    gravity.update(16);
    gravity.update(16);
    gravity.update(16);
    gravity.update(16);
    gravity.update(16);

    // Should only emit once on the first frame, not every frame
    expect(fallingHandler).toHaveBeenCalledTimes(1);
    expect(fallingHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'player-1' }),
    );
  });

  it('should re-emit gravity:falling after landing and becoming airborne again', () => {
    const { engine, gravity } = setup({ strength: 980 });
    const fallingHandler = vi.fn();
    engine.eventBus.on('gravity:falling', fallingHandler);

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    // Fall and land
    for (let i = 0; i < 200; i++) gravity.update(16);
    const firstCallCount = fallingHandler.mock.calls.length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // Make airborne again via jump
    engine.eventBus.emit('jump:start', { id: 'player-1' });
    const obj = gravity.getObject('player-1')!;
    obj.y = 0.2; // reset position
    obj.velocityY = -500; // upward

    gravity.update(16);

    // Should have emitted one more gravity:falling
    expect(fallingHandler.mock.calls.length).toBe(firstCallCount + 1);
  });

  it('should re-emit gravity:falling via jump:start event path (fallingEmitted reset)', () => {
    const { engine, gravity } = setup({ strength: 980 });
    const fallingHandler = vi.fn();
    engine.eventBus.on('gravity:falling', fallingHandler);

    gravity.addObject('player-1', { x: 0.5, y: 0.2, floorY: 0.8, airborne: true });

    // First airborne phase — 1 falling event
    gravity.update(16);
    expect(fallingHandler).toHaveBeenCalledTimes(1);

    // Land
    for (let i = 0; i < 200; i++) gravity.update(16);
    expect(gravity.getObject('player-1')!.airborne).toBe(false);

    // Jump again via event
    engine.eventBus.emit('jump:start', { id: 'player-1' });
    expect(gravity.getObject('player-1')!.airborne).toBe(true);

    // Second airborne phase — should emit again
    gravity.update(16);
    expect(fallingHandler).toHaveBeenCalledTimes(2);
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

  // ── Platform Surface System ──

  describe('surface system', () => {
    const SURFACE_A: PlatformSurface = {
      id: 'plat-0',
      x: 100,
      y: 500,
      width: 200,
      oneWay: false,
      active: true,
    };

    it('should land on a registered surface instead of floorY', () => {
      const { engine, gravity } = setup({ strength: 980 });
      const landHandler = vi.fn();
      engine.eventBus.on('gravity:landed', landHandler);

      // floorY is very far below, but surface is at y=500
      gravity.addObject('p', { x: 150, y: 100, floorY: 9999, airborne: true });
      gravity.addSurface(SURFACE_A);

      // Run until landing
      for (let i = 0; i < 300; i++) gravity.update(16);

      const obj = gravity.getObject('p')!;
      expect(obj.airborne).toBe(false);
      expect(obj.y).toBe(500);
      expect(landHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p', y: 500, surfaceId: 'plat-0' }),
      );
    });

    it('should land on the highest surface below the object', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 'low', x: 100, y: 800, width: 200, oneWay: false, active: true });
      gravity.addSurface({ id: 'high', x: 100, y: 400, width: 200, oneWay: false, active: true });

      gravity.addObject('p', { x: 150, y: 100, floorY: 9999, airborne: true });

      for (let i = 0; i < 300; i++) gravity.update(16);

      expect(gravity.getObject('p')!.y).toBe(400);
    });

    it('should fall through one-way surface when moving upward', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 'ow', x: 100, y: 400, width: 200, oneWay: true, active: true });

      // Object starts below the surface, moving upward (negative velocityY)
      gravity.addObject('p', { x: 150, y: 500, floorY: 9999, airborne: true, velocityY: -300 });

      gravity.update(16);

      // Should NOT land on the one-way platform while moving up
      const obj = gravity.getObject('p')!;
      expect(obj.airborne).toBe(true);
    });

    it('should land on one-way surface when falling', () => {
      const { engine, gravity } = setup({ strength: 980 });
      const landHandler = vi.fn();
      engine.eventBus.on('gravity:landed', landHandler);

      gravity.addSurface({ id: 'ow', x: 100, y: 500, width: 200, oneWay: true, active: true });
      gravity.addObject('p', { x: 150, y: 100, floorY: 9999, airborne: true });

      for (let i = 0; i < 300; i++) gravity.update(16);

      expect(gravity.getObject('p')!.y).toBe(500);
      expect(landHandler).toHaveBeenCalled();
    });

    it('should ignore inactive surfaces', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 'dead', x: 100, y: 400, width: 200, oneWay: false, active: false });
      gravity.addObject('p', { x: 150, y: 100, floorY: 800, airborne: true });

      for (let i = 0; i < 300; i++) gravity.update(16);

      // Should fall to floorY, not the inactive surface
      expect(gravity.getObject('p')!.y).toBe(800);
    });

    it('should update surface position dynamically', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 's1', x: 100, y: 500, width: 200, oneWay: false, active: true });
      gravity.addObject('p', { x: 150, y: 100, floorY: 9999, airborne: true });

      // Move surface down before object reaches it
      gravity.updateSurface('s1', { y: 700 });

      for (let i = 0; i < 300; i++) gravity.update(16);

      expect(gravity.getObject('p')!.y).toBe(700);
    });

    it('should remove surface causing object to fall to next surface or floorY', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 's1', x: 100, y: 400, width: 200, oneWay: false, active: true });
      gravity.addObject('p', { x: 150, y: 400, floorY: 800, airborne: false });

      // Remove the surface — object should become airborne
      gravity.removeSurface('s1');

      // Object is no longer on any surface, mark airborne
      gravity.checkSurfaceDeparture('p');

      for (let i = 0; i < 300; i++) gravity.update(16);

      expect(gravity.getObject('p')!.y).toBe(800);
    });

    it('should not land on surface when object X is outside surface range', () => {
      const { gravity } = setup({ strength: 980 });

      // Surface at x=100, width=200, so range is [100, 300]
      gravity.addSurface({ id: 's1', x: 100, y: 400, width: 200, oneWay: false, active: true });
      // Object at x=50 — outside platform range
      gravity.addObject('p', { x: 50, y: 100, floorY: 800, airborne: true });

      for (let i = 0; i < 300; i++) gravity.update(16);

      // Should fall to floorY, not the surface
      expect(gravity.getObject('p')!.y).toBe(800);
    });

    it('should become airborne when walking off surface edge', () => {
      const { engine, gravity } = setup({ strength: 980 });
      const fallingHandler = vi.fn();
      engine.eventBus.on('gravity:falling', fallingHandler);

      gravity.addSurface({ id: 's1', x: 100, y: 400, width: 200, oneWay: false, active: true });
      gravity.addObject('p', { x: 150, y: 400, floorY: 800, airborne: false });

      // Move object off the edge (x goes past surface range)
      const obj = gravity.getObject('p')!;
      // Update object position immutably via internal Map
      (gravity as any).objects.set('p', { ...obj, x: 350 }); // past x + width = 300

      gravity.checkSurfaceDeparture('p');
      gravity.update(16);

      const updated = gravity.getObject('p')!;
      expect(updated.airborne).toBe(true);
      expect(fallingHandler).toHaveBeenCalled();
    });

    it('should clear surfaces on reset', () => {
      const { gravity } = setup();
      gravity.addSurface(SURFACE_A);

      expect(gravity.getSurfaces().length).toBe(1);

      gravity.reset();

      expect(gravity.getSurfaces().length).toBe(0);
    });

    it('should deactivate surface and object falls through', () => {
      const { gravity } = setup({ strength: 980 });

      gravity.addSurface({ id: 's1', x: 100, y: 400, width: 200, oneWay: false, active: true });
      gravity.addObject('p', { x: 150, y: 400, floorY: 800, airborne: false });

      // Deactivate surface (crumble)
      gravity.updateSurface('s1', { active: false });
      gravity.checkSurfaceDeparture('p');

      for (let i = 0; i < 300; i++) gravity.update(16);

      expect(gravity.getObject('p')!.y).toBe(800);
    });
  });
});
