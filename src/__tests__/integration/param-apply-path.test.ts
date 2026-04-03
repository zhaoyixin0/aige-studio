/**
 * B11: Integration test — full applyChanges path
 *
 * Tests that ConfigLoader.applyChanges correctly calls mod.configure()
 * on running engine modules, verifying the Store→Engine bridge path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig, ConfigChange } from '@/engine/core';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
    { id: 'collision', type: 'Collision', enabled: true, params: { hitboxScale: 1.0 } },
    { id: 'timer', type: 'Timer', enabled: true, params: { duration: 30 } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
});

describe('param-apply-path integration', () => {
  let engine: Engine;
  let loader: ConfigLoader;

  beforeEach(() => {
    engine = new Engine();
    const registry = createModuleRegistry();
    loader = new ConfigLoader(registry);

    // Load initial config — creates and starts modules
    loader.load(engine, makeConfig());
    engine.start();
  });

  it('applyChanges update_param calls configure() on the target module', () => {
    const spawner = engine.getModule('spawner')!;
    expect(spawner).toBeTruthy();

    const changes: ConfigChange[] = [
      { op: 'update_param', moduleId: 'spawner', params: { frequency: 5 } },
    ];

    loader.applyChanges(engine, changes);

    // After configure(), the module's params should reflect the change
    expect(spawner.getParams().frequency).toBe(5);
    // Original param should be preserved
    expect(spawner.getParams().speed).toBe(200);
  });

  it('applyChanges with multiple update_param changes', () => {
    const changes: ConfigChange[] = [
      { op: 'update_param', moduleId: 'spawner', params: { frequency: 3, speed: 500 } },
      { op: 'update_param', moduleId: 'scorer', params: { perHit: 25 } },
      { op: 'update_param', moduleId: 'lives', params: { count: 5 } },
    ];

    loader.applyChanges(engine, changes);

    expect(engine.getModule('spawner')!.getParams().frequency).toBe(3);
    expect(engine.getModule('spawner')!.getParams().speed).toBe(500);
    expect(engine.getModule('scorer')!.getParams().perHit).toBe(25);
    expect(engine.getModule('lives')!.getParams().count).toBe(5);
  });

  it('applyChanges ignores non-existent moduleId gracefully', () => {
    const changes: ConfigChange[] = [
      { op: 'update_param', moduleId: 'nonexistent', params: { foo: 1 } },
    ];

    // Should not throw
    expect(() => loader.applyChanges(engine, changes)).not.toThrow();
  });

  it('applyChanges with empty changes array does nothing', () => {
    const spawnerParams = { ...engine.getModule('spawner')!.getParams() };

    loader.applyChanges(engine, []);

    expect(engine.getModule('spawner')!.getParams().frequency).toBe(spawnerParams.frequency);
  });

  it('engine modules remain functional after applyChanges', () => {
    const changes: ConfigChange[] = [
      { op: 'update_param', moduleId: 'timer', params: { duration: 60 } },
    ];

    loader.applyChanges(engine, changes);

    // Engine should still be running
    expect(engine.getModule('timer')!.getParams().duration).toBe(60);

    // Simulate one tick — should not throw
    expect(() => engine.tick(16)).not.toThrow();
  });
});
