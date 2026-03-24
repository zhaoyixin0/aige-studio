import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { AutoWirer } from '../auto-wirer';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';

describe('AutoWirer', () => {
  it('should wire Spawner to Collision: emit spawner:created registers object in Collision', () => {
    const engine = new Engine();

    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      frequency: 1,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);

    // Wire the engine
    AutoWirer.wire(engine);

    // Spy on collision.registerObject
    const registerSpy = vi.spyOn(collision, 'registerObject');

    // Simulate spawner:created event
    engine.eventBus.emit('spawner:created', {
      id: 'spawn-99',
      x: 100,
      y: 50,
    });

    expect(registerSpy).toHaveBeenCalledOnce();
    expect(registerSpy).toHaveBeenCalledWith('spawn-99', 'items', {
      x: 100,
      y: 50,
      radius: 24,
    });

    // Simulate spawner:destroyed — should unregister
    const unregisterSpy = vi.spyOn(collision, 'unregisterObject');
    engine.eventBus.emit('spawner:destroyed', { id: 'spawn-99' });

    expect(unregisterSpy).toHaveBeenCalledOnce();
    expect(unregisterSpy).toHaveBeenCalledWith('spawn-99');
  });
});
