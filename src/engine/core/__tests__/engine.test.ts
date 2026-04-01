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
    getContracts: vi.fn(() => ({})),
    getDependencies: vi.fn(() => ({ requires: [], optional: [] })),
    onAttach: vi.fn(),
    onDetach: vi.fn(),
  };
}

function createThrowingModule(id: string, type: string): GameModule {
  const mod = createTestModule(id, type);
  mod.update = vi.fn(() => { throw new Error(`${id} exploded`); });
  return mod;
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

  // ── Fault Isolation (Step 1.1 + 1.3) ──

  describe('fault isolation', () => {
    it('tick() should continue updating other modules when one throws', () => {
      const engine = new Engine();
      const good1 = createTestModule('good1', 'A');
      const bad = createThrowingModule('bad', 'B');
      const good2 = createTestModule('good2', 'C');

      engine.addModule(good1);
      engine.addModule(bad);
      engine.addModule(good2);

      // Should NOT throw — error is isolated
      expect(() => engine.tick(16)).not.toThrow();

      expect(good1.update).toHaveBeenCalledWith(16);
      expect(good2.update).toHaveBeenCalledWith(16);
    });

    it('tick() should disable a module after it throws and skip it on subsequent ticks', () => {
      const engine = new Engine();
      const bad = createThrowingModule('bad', 'B');
      const good = createTestModule('good', 'A');

      engine.addModule(bad);
      engine.addModule(good);

      engine.tick(16); // first tick — bad throws, gets disabled
      engine.tick(16); // second tick — bad should be skipped

      // bad.update called only once (first tick), then disabled
      expect(bad.update).toHaveBeenCalledTimes(1);
      expect(good.update).toHaveBeenCalledTimes(2);
    });

    it('tick() should emit engine:module-error only once for a disabled module', () => {
      const engine = new Engine();
      const bad = createThrowingModule('bad', 'B');
      const errorHandler = vi.fn();

      engine.addModule(bad);
      engine.eventBus.on('engine:module-error', errorHandler);
      engine.tick(16);
      engine.tick(16);

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('tick() should emit engine:module-error when a module throws', () => {
      const engine = new Engine();
      const bad = createThrowingModule('bad', 'B');
      const errorHandler = vi.fn();

      engine.addModule(bad);
      engine.eventBus.on('engine:module-error', errorHandler);
      engine.tick(16);

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: 'bad',
          moduleType: 'B',
        }),
      );
    });

    it('addModule() should not register a module whose init() throws', () => {
      const engine = new Engine();
      const mod = createTestModule('bad-init', 'X');
      mod.init = vi.fn(() => { throw new Error('init failed'); });

      expect(() => engine.addModule(mod)).toThrow('init failed');
      expect(engine.getModule('bad-init')).toBeUndefined();
      expect(mod.destroy).toHaveBeenCalled();
    });

    it('addModule() should preserve original error when destroy() also throws', () => {
      const engine = new Engine();
      const mod = createTestModule('bad-init', 'X');
      mod.init = vi.fn(() => { throw new Error('init failed'); });
      mod.destroy = vi.fn(() => { throw new Error('destroy also failed'); });

      expect(() => engine.addModule(mod)).toThrow('init failed');
      expect(engine.getModule('bad-init')).toBeUndefined();
    });

    it('removeModule() should not throw when onDetach throws', () => {
      const engine = new Engine();
      const mod = createTestModule('fragile', 'F');
      mod.onDetach = vi.fn(() => { throw new Error('detach boom'); });

      engine.addModule(mod);

      expect(() => engine.removeModule('fragile')).not.toThrow();
      expect(engine.getModule('fragile')).toBeUndefined();
    });

    it('removeModule() should emit engine:module-error when onDetach/destroy throws', () => {
      const engine = new Engine();
      const mod = createTestModule('fragile', 'F');
      mod.onDetach = vi.fn(() => { throw new Error('detach boom'); });
      mod.destroy = vi.fn(() => { throw new Error('destroy boom'); });

      engine.addModule(mod);
      const errorHandler = vi.fn();
      engine.eventBus.on('engine:module-error', errorHandler);
      engine.removeModule('fragile');

      expect(errorHandler).toHaveBeenCalledTimes(2);
      expect(engine.getModule('fragile')).toBeUndefined();
    });

    it('removeModule() should always delete module from map even if lifecycle throws', () => {
      const engine = new Engine();
      const mod = createTestModule('fragile', 'F');
      mod.destroy = vi.fn(() => { throw new Error('destroy boom'); });

      engine.addModule(mod);
      engine.removeModule('fragile');

      expect(engine.getModule('fragile')).toBeUndefined();
      expect(mod.destroy).toHaveBeenCalled();
    });
  });
});
