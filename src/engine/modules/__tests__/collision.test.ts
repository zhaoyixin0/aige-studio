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
});
