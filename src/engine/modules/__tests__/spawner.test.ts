import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core';
import { Spawner } from '../mechanic/spawner';

describe('Spawner', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      speed: { min: 100, max: 200 },
      frequency: 1, // 1 second between spawns
      spawnArea: { x: 0, y: 0, width: 800, height: 0 },
      direction: 'down',
      maxCount: 10,
      ...params,
    });
    engine.addModule(spawner);
    return { engine, spawner };
  }

  it('should spawn objects at configured frequency', () => {
    const { engine, spawner } = setup({ frequency: 1 });

    // After 0.5s — no spawn yet
    engine.tick(500);
    expect(spawner.getObjects()).toHaveLength(0);

    // After another 0.5s (total 1s) — should spawn
    engine.tick(500);
    expect(spawner.getObjects()).toHaveLength(1);
  });

  it('should respect maxCount limit', () => {
    const { engine, spawner } = setup({ frequency: 0.5, maxCount: 3 });

    // Tick enough to trigger many spawns
    for (let i = 0; i < 20; i++) {
      engine.tick(500);
    }

    expect(spawner.getObjects().length).toBeLessThanOrEqual(3);
  });

  it('should pause on gameflow:pause', () => {
    const { engine, spawner } = setup({ frequency: 1 });

    // Pause the game
    engine.eventBus.emit('gameflow:pause');

    // Tick past spawn frequency
    engine.tick(2000);

    // Should not have spawned anything while paused
    expect(spawner.getObjects()).toHaveLength(0);
  });
});
