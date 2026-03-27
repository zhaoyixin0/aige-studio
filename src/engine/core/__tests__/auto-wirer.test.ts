import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { AutoWirer } from '../auto-wirer';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';
import { Projectile } from '@/engine/modules/mechanic/projectile';
import { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';

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

    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

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

    const unregisterSpy = vi.spyOn(collision, 'unregisterObject');
    engine.eventBus.emit('spawner:destroyed', { id: 'spawn-99' });

    expect(unregisterSpy).toHaveBeenCalledOnce();
    expect(unregisterSpy).toHaveBeenCalledWith('spawn-99');
  });

  it('should use pre-update hooks instead of monkey-patching collision.update', () => {
    const engine = new Engine();

    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      frequency: 1,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);

    // Save original update reference
    const originalUpdate = collision.update;

    AutoWirer.wire(engine);

    // update method should NOT be replaced (no monkey-patch)
    expect(collision.update).toBe(originalUpdate);
  });

  it('should register pre-update hook for Spawner position sync', () => {
    const engine = new Engine();

    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      frequency: 1,
    });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(collision);

    const hookSpy = vi.spyOn(collision, 'addPreUpdateHook');

    AutoWirer.wire(engine);

    expect(hookSpy).toHaveBeenCalledOnce();
  });

  it('should register pre-update hook for Projectile position sync', () => {
    const engine = new Engine();

    const projectile = new Projectile('projectile-1', {});
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(projectile);
    engine.addModule(collision);

    const hookSpy = vi.spyOn(collision, 'addPreUpdateHook');

    AutoWirer.wire(engine);

    expect(hookSpy).toHaveBeenCalledOnce();
  });

  it('should support multiple hooks from Spawner + Projectile without conflict', () => {
    const engine = new Engine();

    const spawner = new Spawner('spawner-1', {
      items: [{ asset: 'apple', weight: 1 }],
      frequency: 1,
    });
    const projectile = new Projectile('projectile-1', {});
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(spawner);
    engine.addModule(projectile);
    engine.addModule(collision);

    const hookSpy = vi.spyOn(collision, 'addPreUpdateHook');

    AutoWirer.wire(engine);

    // Both Spawner+Collision and Projectile+Collision should register hooks
    expect(hookSpy).toHaveBeenCalledTimes(2);
  });

  it('should use projectile collisionRadius param for projectile registration', () => {
    const engine = new Engine();

    const projectile = new Projectile('projectile-1', { collisionRadius: 12 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(projectile);
    engine.addModule(collision);

    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('projectile:fire', { id: 'proj-1', x: 50, y: 50 });

    expect(registerSpy).toHaveBeenCalledWith('proj-1', 'projectiles', {
      x: 50,
      y: 50,
      radius: 12,
    });
  });

  it('should use default projectile collisionRadius when not specified', () => {
    const engine = new Engine();

    const projectile = new Projectile('projectile-1', {});
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(projectile);
    engine.addModule(collision);

    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('projectile:fire', { id: 'proj-1', x: 50, y: 50 });

    // Should use schema default (8), not a hardcoded magic number
    expect(registerSpy).toHaveBeenCalledWith('proj-1', 'projectiles', {
      x: 50,
      y: 50,
      radius: 8,
    });
  });

  it('should use WaveSpawner enemyCollisionRadius param for enemy registration', () => {
    const engine = new Engine();

    const waveSpawner = new WaveSpawner('wavespawner-1', { enemyCollisionRadius: 32 });
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(waveSpawner);
    engine.addModule(collision);

    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 200, y: 100 });

    expect(registerSpy).toHaveBeenCalledWith('enemy-1', 'enemies', {
      x: 200,
      y: 100,
      radius: 32,
    });
  });

  it('should use default enemyCollisionRadius when not specified', () => {
    const engine = new Engine();

    const waveSpawner = new WaveSpawner('wavespawner-1', {});
    const collision = new Collision('collision-1', { rules: [] });

    engine.addModule(waveSpawner);
    engine.addModule(collision);

    AutoWirer.wire(engine);

    const registerSpy = vi.spyOn(collision, 'registerObject');

    engine.eventBus.emit('wave:spawn', { id: 'enemy-1', x: 200, y: 100 });

    // Default radius = 24
    expect(registerSpy).toHaveBeenCalledWith('enemy-1', 'enemies', {
      x: 200,
      y: 100,
      radius: 24,
    });
  });
});
