import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@/engine/core/event-bus';
import { AutoWirer } from '@/engine/core/auto-wirer';
import type { GameEngine, GameModule, ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

class FakeRunner {
  readonly id = 'runner_1';
  readonly type = 'Runner';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    emits: ['runner:distance', 'runner:laneChange'],
    consumes: ['gameflow:pause', 'gameflow:resume'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({});
  onAttach = vi.fn();
  onDetach = vi.fn();
}

class FakeScrollingLayers {
  readonly id = 'scrolling_1';
  readonly type = 'ScrollingLayers';
  getSchema = (): ModuleSchema => ({});
  getDependencies = () => ({ requires: [], optional: [] });
  getContracts = (): ModuleContracts => ({
    emits: ['scrolling:update'],
    consumes: ['scrolling:set-speed', 'scrolling:set-direction'],
    capabilities: ['parallax-controller'],
  });
  init = vi.fn();
  update = vi.fn();
  destroy = vi.fn();
  configure = vi.fn();
  getParams = () => ({ baseSpeed: 200 });
  onAttach = vi.fn();
  onDetach = vi.fn();
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

describe('AutoWirer Runner+ScrollingLayers Bridge', () => {
  it('runner:distance syncs scrolling speed', () => {
    const runner = new FakeRunner();
    const scrolling = new FakeScrollingLayers();
    const engine = createEngine([runner as unknown as GameModule, scrolling as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('scrolling:set-speed', spy);

    engine.eventBus.emit('runner:distance', { distance: 500, speed: 350 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ speed: 350 }),
    );
  });

  it('ignores invalid speed values', () => {
    const runner = new FakeRunner();
    const scrolling = new FakeScrollingLayers();
    const engine = createEngine([runner as unknown as GameModule, scrolling as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('scrolling:set-speed', spy);

    engine.eventBus.emit('runner:distance', { distance: 100 }); // no speed field

    expect(spy).not.toHaveBeenCalled();
  });

  it('no bridge without ScrollingLayers', () => {
    const runner = new FakeRunner();
    const engine = createEngine([runner as unknown as GameModule]);
    AutoWirer.wire(engine);

    const spy = vi.fn();
    engine.eventBus.on('scrolling:set-speed', spy);

    engine.eventBus.emit('runner:distance', { distance: 500, speed: 350 });

    expect(spy).not.toHaveBeenCalled();
  });
});
