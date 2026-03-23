import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import type { GameModule, ModuleSchema } from '../types';

function createTestModule(id: string, type: string): GameModule {
  return {
    id,
    type,
    init: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    getSchema: vi.fn<() => ModuleSchema>(() => ({})),
    configure: vi.fn(),
    getParams: vi.fn<() => Record<string, any>>(() => ({})),
    onAttach: vi.fn(),
    onDetach: vi.fn(),
  };
}

describe('Engine', () => {
  it('should add and retrieve modules, calling init and onAttach', () => {
    const engine = new Engine();
    const mod = createTestModule('spawner-1', 'spawner');

    engine.addModule(mod);

    expect(mod.init).toHaveBeenCalledOnce();
    expect(mod.init).toHaveBeenCalledWith(engine);
    expect(mod.onAttach).toHaveBeenCalledOnce();
    expect(mod.onAttach).toHaveBeenCalledWith(engine);
    expect(engine.getModule('spawner-1')).toBe(mod);
  });

  it('should remove modules, calling onDetach and destroy', () => {
    const engine = new Engine();
    const mod = createTestModule('spawner-1', 'spawner');

    engine.addModule(mod);
    engine.removeModule('spawner-1');

    expect(mod.onDetach).toHaveBeenCalledOnce();
    expect(mod.onDetach).toHaveBeenCalledWith(engine);
    expect(mod.destroy).toHaveBeenCalledOnce();
    expect(engine.getModule('spawner-1')).toBeUndefined();
  });

  it('should call update on all modules each tick', () => {
    const engine = new Engine();
    const mod1 = createTestModule('a', 'typeA');
    const mod2 = createTestModule('b', 'typeB');

    engine.addModule(mod1);
    engine.addModule(mod2);
    engine.tick(16);

    expect(mod1.update).toHaveBeenCalledOnce();
    expect(mod1.update).toHaveBeenCalledWith(16);
    expect(mod2.update).toHaveBeenCalledOnce();
    expect(mod2.update).toHaveBeenCalledWith(16);
  });

  it('should get modules by type', () => {
    const engine = new Engine();
    const mod1 = createTestModule('s1', 'spawner');
    const mod2 = createTestModule('s2', 'spawner');
    const mod3 = createTestModule('c1', 'collision');

    engine.addModule(mod1);
    engine.addModule(mod2);
    engine.addModule(mod3);

    const spawners = engine.getModulesByType('spawner');
    expect(spawners).toHaveLength(2);
    expect(spawners).toContain(mod1);
    expect(spawners).toContain(mod2);

    const collisions = engine.getModulesByType('collision');
    expect(collisions).toHaveLength(1);
    expect(collisions).toContain(mod3);
  });
});
