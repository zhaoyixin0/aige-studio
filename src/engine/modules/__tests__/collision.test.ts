import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Collision } from '../mechanic/collision';

describe('Collision', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const collision = new Collision('collision-1', {
      rules: [
        { a: 'player', b: 'enemy', event: 'hit', destroy: ['b'] },
      ],
      ...params,
    });
    engine.addModule(collision);
    engine.eventBus.emit('gameflow:resume');
    return { engine, collision };
  }

  it('should detect circle-circle collision when overlapping', () => {
    const { engine, collision } = setup();
    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    // Register two overlapping objects
    collision.registerObject('player-1', 'player', { x: 100, y: 100, radius: 30 });
    collision.registerObject('enemy-1', 'enemy', { x: 120, y: 100, radius: 30 });

    // Run collision detection
    engine.tick(16);

    expect(hitHandler).toHaveBeenCalledOnce();
    expect(hitHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        objectA: 'player-1',
        objectB: 'enemy-1',
        layerA: 'player',
        layerB: 'enemy',
      }),
    );
  });

  it('should NOT detect collision when objects are far apart', () => {
    const { engine, collision } = setup();
    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    // Register two distant objects
    collision.registerObject('player-1', 'player', { x: 0, y: 0, radius: 10 });
    collision.registerObject('enemy-1', 'enemy', { x: 500, y: 500, radius: 10 });

    engine.tick(16);

    expect(hitHandler).not.toHaveBeenCalled();
  });

  it('should unregister destroyed objects so no second collision', () => {
    const { engine, collision } = setup({
      rules: [
        { a: 'player', b: 'enemy', event: 'hit', destroy: ['b'] },
      ],
    });
    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    collision.registerObject('player-1', 'player', { x: 100, y: 100, radius: 30 });
    collision.registerObject('enemy-1', 'enemy', { x: 120, y: 100, radius: 30 });

    // First tick — collision detected, enemy-1 destroyed
    engine.tick(16);
    expect(hitHandler).toHaveBeenCalledOnce();

    // Second tick — enemy-1 should be gone, no collision
    engine.tick(16);
    expect(hitHandler).toHaveBeenCalledOnce(); // still just once
  });

  describe('pre-update hooks', () => {
    it('should call pre-update hooks before collision detection', () => {
      const { engine, collision } = setup();
      const callOrder: string[] = [];

      // Register hook that moves an object
      collision.addPreUpdateHook(() => {
        callOrder.push('hook');
        collision.updateObject('enemy-1', { x: 100, y: 100 });
      });

      const hitHandler = vi.fn(() => callOrder.push('collision'));
      engine.eventBus.on('collision:hit', hitHandler);

      // Start far apart — hook will move enemy close
      collision.registerObject('player-1', 'player', { x: 100, y: 100, radius: 30 });
      collision.registerObject('enemy-1', 'enemy', { x: 999, y: 999, radius: 30 });

      engine.tick(16);

      // Hook ran first, moved enemy close, then collision detected
      expect(callOrder).toEqual(['hook', 'collision']);
      expect(hitHandler).toHaveBeenCalledOnce();
    });

    it('should support multiple pre-update hooks without overwriting', () => {
      const { engine, collision } = setup();
      const hookCalls: number[] = [];

      collision.addPreUpdateHook(() => hookCalls.push(1));
      collision.addPreUpdateHook(() => hookCalls.push(2));
      collision.addPreUpdateHook(() => hookCalls.push(3));

      collision.registerObject('player-1', 'player', { x: 0, y: 0, radius: 10 });

      engine.tick(16);

      expect(hookCalls).toEqual([1, 2, 3]);
    });

    it('should pass dt to pre-update hooks', () => {
      const { engine, collision } = setup();
      const receivedDt: number[] = [];

      collision.addPreUpdateHook((dt) => receivedDt.push(dt));

      collision.registerObject('player-1', 'player', { x: 0, y: 0, radius: 10 });

      engine.tick(16);
      engine.tick(32);

      expect(receivedDt).toEqual([16, 32]);
    });

    it('should clear hooks on reset', () => {
      const { engine, collision } = setup();
      const hookCalls: number[] = [];

      collision.addPreUpdateHook(() => hookCalls.push(1));

      collision.registerObject('player-1', 'player', { x: 0, y: 0, radius: 10 });

      engine.tick(16);
      expect(hookCalls).toEqual([1]);

      collision.reset();
      collision.registerObject('player-1', 'player', { x: 0, y: 0, radius: 10 });

      engine.tick(16);
      // Hook should not fire after reset
      expect(hookCalls).toEqual([1]);
    });
  });
});
