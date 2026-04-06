import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@/engine/core/event-bus';
import { AutoWirer } from '@/engine/core/auto-wirer';
import type { GameEngine, GameModule, ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

class FakePhysics2D {
  readonly id = 'physics2d_1';
  readonly type = 'Physics2D';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    emits: ['physics2d:contact-begin', 'physics2d:contact-end'],
    consumes: ['physics2d:add-body', 'physics2d:remove-body'],
    capabilities: ['physics2d-provider'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
  getBodyPosition = vi.fn().mockReturnValue({ x: 100, y: 200 });
}

class FakeSpawner {
  readonly id = 'spawner_1';
  readonly type = 'Spawner';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    collisionProvider: { layer: 'items', radius: 30, spawnEvent: 'spawner:created', destroyEvent: 'spawner:destroyed' },
    emits: ['spawner:created', 'spawner:destroyed'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({ spriteSize: 48 });
  onAttach = vi.fn();
  onDetach = vi.fn();
}

class FakeTween {
  readonly id = 'tween_1';
  readonly type = 'Tween';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    emits: ['tween:start', 'tween:complete'],
    consumes: ['tween:trigger'],
    capabilities: ['tween-provider'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
}

class FakeCollision {
  readonly id = 'collision_1';
  readonly type = 'Collision';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({});
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({ rules: [] });
  onAttach = vi.fn();
  onDetach = vi.fn();
  registerObject = vi.fn();
  unregisterObject = vi.fn();
  updateObject = vi.fn();
  addPreUpdateHook = vi.fn();
  getObjectIds = vi.fn().mockReturnValue(['item_1', 'item_2']);
}

function createEngine(modules: GameModule[]): GameEngine {
  const eventBus = new EventBus();
  return {
    eventBus,
    getModule: (id: string) => modules.find((m) => m.id === id),
    getModulesByType: (type: string) => modules.filter((m) => m.type === type),
    getAllModules: () => modules,
    getConfig: () => ({
      version: '1', meta: { name: '', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 }, modules: [], assets: {},
    }),
    getCanvas: () => ({ width: 1080, height: 1920 }),
  };
}

describe('AutoWirer Spawner+Physics2D Bridge', () => {
  it('spawner:created emits physics2d:add-body', () => {
    const phys = new FakePhysics2D();
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule, phys as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('physics2d:add-body', spy);

    engine.eventBus.emit('spawner:created', { id: 'item_1', x: 100, y: 200 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'item_1',
        x: 100,
        y: 200,
      }),
    );
  });

  it('spawner:destroyed emits physics2d:remove-body', () => {
    const phys = new FakePhysics2D();
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule, phys as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('physics2d:remove-body', spy);

    engine.eventBus.emit('spawner:destroyed', { id: 'item_2' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'item_2' }),
    );
  });

  it('no bridge without Physics2D module', () => {
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('physics2d:add-body', spy);
    engine.eventBus.emit('spawner:created', { id: 'item_1', x: 0, y: 0 });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('AutoWirer Physics2D+Collision Bridge', () => {
  it('registers a preUpdateHook on Collision', () => {
    const phys = new FakePhysics2D();
    const collision = new FakeCollision();
    const engine = createEngine([phys as unknown as GameModule, collision as unknown as GameModule]);
    AutoWirer.wire(engine);

    expect(collision.addPreUpdateHook).toHaveBeenCalled();
  });

  it('preUpdateHook mirrors Physics2D positions into Collision', () => {
    const phys = new FakePhysics2D();
    const collision = new FakeCollision();
    const engine = createEngine([phys as unknown as GameModule, collision as unknown as GameModule]);
    AutoWirer.wire(engine);

    // Get the hook that was registered
    const hook = collision.addPreUpdateHook.mock.calls[0]?.[0];
    expect(hook).toBeDefined();

    // Run the hook
    hook();

    // Should have called updateObject for each collision object ID
    expect(collision.updateObject).toHaveBeenCalledWith('item_1', { x: 100, y: 200 });
    expect(collision.updateObject).toHaveBeenCalledWith('item_2', { x: 100, y: 200 });
  });
});

describe('AutoWirer Physics2D+Tween Bridge', () => {
  it('maps contact-begin to tween:trigger when Collision is absent', () => {
    const phys = new FakePhysics2D();
    const tween = new FakeTween();
    const engine = createEngine([phys as unknown as GameModule, tween as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('physics2d:contact-begin', {
      entityIdA: 'ball_1', entityIdB: 'wall_1',
      pointX: 100, pointY: 200, normalX: 1, normalY: 0,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ clipId: 'hit', entityId: 'wall_1' }),
    );
  });

  it('does NOT map contacts when Collision is present', () => {
    const phys = new FakePhysics2D();
    const tween = new FakeTween();
    const collision = new FakeCollision();
    const engine = createEngine([
      phys as unknown as GameModule,
      tween as unknown as GameModule,
      collision as unknown as GameModule,
    ]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('physics2d:contact-begin', {
      entityIdA: 'ball_1', entityIdB: 'wall_1',
      pointX: 100, pointY: 200, normalX: 1, normalY: 0,
    });

    // Tween trigger should NOT have been called from Physics2D contacts
    // (only the existing Collision+Tween bridge handles this)
    const physics2dCalls = spy.mock.calls.filter(
      (args: any[]) => args[0]?.clipId === 'hit' && args[0]?.entityId === 'wall_1',
    );
    expect(physics2dCalls).toHaveLength(0);
  });
});
