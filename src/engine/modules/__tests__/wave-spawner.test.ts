import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { WaveSpawner } from '../mechanic/wave-spawner';

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  const mod = new WaveSpawner('wave-1', params);
  engine.addModule(mod);
  // gameflow:resume is emitted in individual tests as needed
  return { engine, mod };
}

describe('WaveSpawner', () => {
  it('should start first wave on gameflow:resume', () => {
    const { engine, mod } = setup({ enemiesPerWave: 3 });

    const handler = vi.fn();
    engine.eventBus.on('wave:start', handler);

    engine.eventBus.emit('gameflow:resume');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({ wave: 1, enemyCount: 3 });
    expect(mod.getCurrentWave()).toBe(1);
  });

  it('should emit wave:spawn events at spawnDelay intervals', () => {
    const { engine } = setup({ enemiesPerWave: 3, spawnDelay: 500 });
    const spawnHandler = vi.fn();
    engine.eventBus.on('wave:spawn', spawnHandler);

    engine.eventBus.emit('gameflow:resume');

    // No spawns yet
    expect(spawnHandler).not.toHaveBeenCalled();

    engine.tick(500); // first spawn
    expect(spawnHandler).toHaveBeenCalledTimes(1);

    engine.tick(500); // second spawn
    expect(spawnHandler).toHaveBeenCalledTimes(2);

    engine.tick(500); // third spawn
    expect(spawnHandler).toHaveBeenCalledTimes(3);

    // No more spawns — wave has 3 enemies
    engine.tick(500);
    expect(spawnHandler).toHaveBeenCalledTimes(3);
  });

  it('should emit wave:complete when all enemies die', () => {
    const { engine, mod } = setup({ enemiesPerWave: 2, spawnDelay: 100 });
    const completeHandler = vi.fn();
    engine.eventBus.on('wave:complete', completeHandler);

    engine.eventBus.emit('gameflow:resume');

    // Spawn all enemies
    engine.tick(100);
    engine.tick(100);

    expect(mod.getEnemiesRemaining()).toBe(2);

    // Kill enemies
    engine.eventBus.emit('enemy:death', { id: 'e1' });
    engine.eventBus.emit('enemy:death', { id: 'e2' });

    expect(completeHandler).toHaveBeenCalledWith(expect.objectContaining({ wave: 1 }));
  });

  it('should scale enemy count each wave', () => {
    const { engine, mod } = setup({
      enemiesPerWave: 5,
      scalingFactor: 1.2,
      spawnDelay: 100,
      waveCooldown: 100,
    });

    engine.eventBus.emit('gameflow:resume');

    // Spawn and kill wave 1 (5 enemies)
    for (let i = 0; i < 5; i++) engine.tick(100);
    for (let i = 0; i < 5; i++) engine.eventBus.emit('enemy:death', { id: `e${i}` });

    // Wait for cooldown
    engine.tick(200);

    // Wave 2 should have ceil(5 * 1.2) = 6 enemies
    const wave2Count = mod.getEnemiesRemaining();
    expect(wave2Count).toBe(6);
    expect(mod.getCurrentWave()).toBe(2);
  });

  it('should emit wave:allComplete when maxWaves reached', () => {
    const { engine } = setup({
      enemiesPerWave: 1,
      maxWaves: 2,
      spawnDelay: 100,
      waveCooldown: 100,
      scalingFactor: 1.0, // no scaling — 1 enemy per wave
    });

    const allCompleteHandler = vi.fn();
    engine.eventBus.on('wave:allComplete', allCompleteHandler);

    engine.eventBus.emit('gameflow:resume');

    // Wave 1: spawn + kill
    engine.tick(100);
    engine.eventBus.emit('enemy:death', { id: 'e1' });

    // Cooldown
    engine.tick(200);

    // Wave 2: spawn + kill
    engine.tick(100);
    engine.eventBus.emit('enemy:death', { id: 'e2' });

    expect(allCompleteHandler).toHaveBeenCalledWith(
      expect.objectContaining({ totalWaves: 2 })
    );
  });

  it('should wait for cooldown between waves', () => {
    const { engine, mod } = setup({
      enemiesPerWave: 1,
      spawnDelay: 100,
      waveCooldown: 1000,
    });

    const startHandler = vi.fn();
    engine.eventBus.on('wave:start', startHandler);

    engine.eventBus.emit('gameflow:resume');
    expect(startHandler).toHaveBeenCalledTimes(1);

    // Kill wave 1
    engine.tick(100);
    engine.eventBus.emit('enemy:death', { id: 'e1' });

    // Short tick — still in cooldown
    engine.tick(500);
    expect(startHandler).toHaveBeenCalledTimes(1);
    expect(mod.getCurrentWave()).toBe(1);

    // Full cooldown elapsed
    engine.tick(600);
    expect(startHandler).toHaveBeenCalledTimes(2);
    expect(mod.getCurrentWave()).toBe(2);
  });

  it('should reset wave counter and state on reset', () => {
    const { engine, mod } = setup({ enemiesPerWave: 2, spawnDelay: 100 });

    engine.eventBus.emit('gameflow:resume');
    engine.tick(100);
    engine.tick(100);

    expect(mod.getCurrentWave()).toBe(1);
    expect(mod.getEnemiesRemaining()).toBe(2);

    mod.reset();

    expect(mod.getCurrentWave()).toBe(0);
    expect(mod.getEnemiesRemaining()).toBe(0);
    expect(mod['waveActive']).toBe(false);
  });

  it('should reset spawn ID counter on reset', () => {
    // First run: spawn some enemies and record their IDs
    const { engine: engine1, mod: mod1 } = setup({ enemiesPerWave: 2, spawnDelay: 100 });
    const spawnedIds1: string[] = [];
    engine1.eventBus.on('wave:spawn', (data: any) => spawnedIds1.push(data.id));

    engine1.eventBus.emit('gameflow:resume');
    engine1.tick(100);
    engine1.tick(100);

    expect(spawnedIds1).toHaveLength(2);

    // Reset and run again — IDs should restart from 1 (not continue from previous run)
    mod1.reset();
    spawnedIds1.length = 0;

    engine1.eventBus.emit('gameflow:resume');
    engine1.tick(100);
    engine1.tick(100);

    // After reset the IDs should start fresh — same as first run
    expect(spawnedIds1[0]).toBe('wave-enemy-1');
    expect(spawnedIds1[1]).toBe('wave-enemy-2');
  });

  it('should give each instance independent spawn ID counters', () => {
    // Two independent WaveSpawner instances should not share ID counter state
    const { engine: engine1, mod: mod1 } = setup({ enemiesPerWave: 1, spawnDelay: 100 });
    const { engine: engine2, mod: mod2 } = setup({ enemiesPerWave: 1, spawnDelay: 100 });

    const ids1: string[] = [];
    const ids2: string[] = [];

    engine1.eventBus.on('wave:spawn', (data: any) => ids1.push(data.id));
    engine2.eventBus.on('wave:spawn', (data: any) => ids2.push(data.id));

    engine1.eventBus.emit('gameflow:resume');
    engine2.eventBus.emit('gameflow:resume');

    engine1.tick(100);
    engine2.tick(100);

    // Both instances should start from wave-enemy-1 independently
    expect(ids1[0]).toBe('wave-enemy-1');
    expect(ids2[0]).toBe('wave-enemy-1');

    // Instances should be independent — void lint warning
    expect(mod1).toBeDefined();
    expect(mod2).toBeDefined();
  });
});
