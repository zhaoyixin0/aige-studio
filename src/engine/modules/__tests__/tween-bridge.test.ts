import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@/engine/core/event-bus';
import { AutoWirer } from '@/engine/core/auto-wirer';
import type { GameEngine, GameModule, ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

class FakeTween {
  readonly id = 'tween_1';
  readonly type = 'Tween';
  startClip = vi.fn();
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    emits: ['tween:start', 'tween:complete'],
    consumes: ['collision:hit', 'tween:trigger'],
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
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
  registerObject = vi.fn();
  unregisterObject = vi.fn();
}

class FakeSpawner {
  readonly id = 'spawner_1';
  readonly type = 'Spawner';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    collisionProvider: {
      layer: 'items',
      radius: 30,
      spawnEvent: 'spawner:created',
      destroyEvent: 'spawner:destroyed',
    },
    emits: ['spawner:created', 'spawner:destroyed'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
}

class FakeEnemyAI {
  readonly id = 'enemyai_1';
  readonly type = 'EnemyAI';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    collisionProvider: {
      layer: 'enemies',
      radius: 30,
    },
    damageReceiver: { handle: vi.fn() },
    emits: ['enemy:death'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
  addEnemy = vi.fn();
  removeEnemy = vi.fn();
  getActiveEnemies = vi.fn().mockReturnValue([]);
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

describe('AutoWirer Tween Bridge', () => {
  let tween: FakeTween;
  let collision: FakeCollision;
  let engine: GameEngine;

  beforeEach(() => {
    tween = new FakeTween();
    collision = new FakeCollision();
    engine = createEngine([collision as unknown as GameModule, tween as unknown as GameModule]);
    AutoWirer.wire(engine);
  });

  it('collision:hit with startOnCollision tag triggers tween:trigger', () => {
    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('collision:hit', {
      objectA: 'proj_1',
      objectB: 'enemy_1',
      layerA: 'projectile',
      layerB: 'enemies',
      targetId: 'enemy_1',
      x: 100,
      y: 200,
    });

    // The bridge should emit tween:trigger for collision events
    // when Tween module is present
    expect(spy).toHaveBeenCalled();
  });

  it('tween bridge does not fire without Tween module', () => {
    const engineNoTween = createEngine([collision as unknown as GameModule]);
    AutoWirer.wire(engineNoTween);

    const spy = vi.fn();
    engineNoTween.eventBus.on('tween:trigger', spy);

    engineNoTween.eventBus.emit('collision:hit', {
      objectA: 'a', objectB: 'b', layerA: 'l1', layerB: 'l2',
      targetId: 'b', x: 0, y: 0,
    });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('AutoWirer Spawner+Tween Bridge', () => {
  it('spawner:created triggers tween:trigger with clipId spawn-in', () => {
    const tween = new FakeTween();
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule, tween as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('spawner:created', { id: 'item_1', x: 100, y: 200 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ clipId: 'spawn-in', entityId: 'item_1' }),
    );
  });

  it('spawner:destroyed triggers tween:trigger with clipId despawn-out', () => {
    const tween = new FakeTween();
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule, tween as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('spawner:destroyed', { id: 'item_2' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ clipId: 'despawn-out', entityId: 'item_2' }),
    );
  });

  it('does not trigger without Tween module present', () => {
    const spawner = new FakeSpawner();
    const engine = createEngine([spawner as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('spawner:created', { id: 'item_1' });
    engine.eventBus.emit('spawner:destroyed', { id: 'item_1' });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('AutoWirer EnemyAI+Tween Bridge', () => {
  it('enemy:death triggers tween:trigger with clipId death-fade', () => {
    const tween = new FakeTween();
    const enemyAI = new FakeEnemyAI();
    const engine = createEngine([enemyAI as unknown as GameModule, tween as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('enemy:death', { id: 'enemy_1', x: 300, y: 400 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ clipId: 'death-fade', entityId: 'enemy_1' }),
    );
  });

  it('does not trigger without Tween module present', () => {
    const enemyAI = new FakeEnemyAI();
    const engine = createEngine([enemyAI as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('tween:trigger', spy);

    engine.eventBus.emit('enemy:death', { id: 'enemy_1' });

    expect(spy).not.toHaveBeenCalled();
  });
});
