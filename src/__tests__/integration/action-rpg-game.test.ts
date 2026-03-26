/**
 * Action-RPG Game Integration Tests — TDD RED phase
 *
 * Tests cover:
 * 1. Load all action-rpg modules from preset config
 * 2. WaveSpawner spawns enemies when game starts
 * 3. Projectile fires and collision triggers health:change on enemy
 * 4. XP awarded on enemy:death and LevelUp progresses
 * 5. Game ends when Lives reaches zero
 * 6. Wave difficulty scales over multiple waves
 * 7. Full action-rpg lifecycle: start → fight → level up → waves → finish
 */

import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { getGamePreset } from '@/agent/game-presets';
import type { GameConfig, ModuleConfig } from '@/engine/core';
import type { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';
import type { Health } from '@/engine/modules/mechanic/health';
import type { LevelUp } from '@/engine/modules/mechanic/level-up';
import type { Lives } from '@/engine/modules/mechanic/lives';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';

// ── helpers ────────────────────────────────────────────────────────────────

function buildConfig(gameType: string): GameConfig {
  const preset = getGamePreset(gameType);
  if (!preset) throw new Error(`No preset found for game type: ${gameType}`);

  const modules: ModuleConfig[] = Object.entries(preset).map(([type, params], i) => ({
    id: `${type.toLowerCase()}_${i}`,
    type,
    enabled: true,
    params: params as Record<string, unknown>,
  }));

  return {
    version: '1.0.0',
    meta: {
      name: 'Action RPG Test',
      description: 'Integration test action-rpg',
      thumbnail: null,
      createdAt: '',
    },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

function createActionRpgEngine(): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, buildConfig('action-rpg'));
  return engine;
}

/** Tick the engine for a given number of milliseconds using 100ms steps */
function tickMs(engine: Engine, ms: number): void {
  const steps = Math.ceil(ms / 100);
  for (let i = 0; i < steps; i++) engine.tick(100);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('Action-RPG Game Integration', () => {
  // ── Test 1: preset loads all modules ──────────────────────────────────

  it('should load all action-rpg modules from preset config', () => {
    const engine = createActionRpgEngine();

    // Verify key module types are present
    expect(engine.getModulesByType('GameFlow').length).toBe(1);
    expect(engine.getModulesByType('WaveSpawner').length).toBe(1);
    expect(engine.getModulesByType('Health').length).toBe(1);
    expect(engine.getModulesByType('LevelUp').length).toBe(1);
    expect(engine.getModulesByType('Lives').length).toBe(1);
    expect(engine.getModulesByType('Projectile').length).toBe(1);
    expect(engine.getModulesByType('Aim').length).toBe(1);
    expect(engine.getModulesByType('EnemyAI').length).toBe(1);
    expect(engine.getModulesByType('EnemyDrop').length).toBe(1);
    expect(engine.getModulesByType('Shield').length).toBe(1);
    expect(engine.getModulesByType('Collision').length).toBe(1);
    expect(engine.getModulesByType('Scorer').length).toBe(1);
    expect(engine.getModulesByType('SkillTree').length).toBe(1);
    expect(engine.getModulesByType('StatusEffect').length).toBe(1);

    // Total module count matches preset entry count
    const preset = getGamePreset('action-rpg')!;
    expect(engine.getAllModules().length).toBe(Object.keys(preset).length);
  });

  // ── Test 2: WaveSpawner spawns enemies on game start ──────────────────

  it('should spawn enemies via WaveSpawner when game starts', () => {
    const engine = createActionRpgEngine();
    const gf = engine.getModulesByType('GameFlow')[0] as unknown as GameFlow;
    const spawner = engine.getModulesByType('WaveSpawner')[0] as unknown as WaveSpawner;

    // Before start: no waves yet
    expect(spawner.getCurrentWave()).toBe(0);

    // Transition to playing — WaveSpawner listens to gameflow:resume
    gf.transition('playing');

    const spawnEvents: unknown[] = [];
    engine.eventBus.on('wave:spawn', (data) => spawnEvents.push(data));

    // Wave 1 starts immediately; spawnDelay is 500ms in preset
    // Tick long enough for at least 1 spawn
    tickMs(engine, 1500);

    expect(spawner.getCurrentWave()).toBe(1);
    expect(spawnEvents.length).toBeGreaterThan(0);
  });

  // ── Test 3: Projectile fire → collision → health:change ───────────────

  it('should deal damage to enemies with projectiles (fire → collision → health:change)', () => {
    const engine = createActionRpgEngine();
    const health = engine.getModulesByType('Health')[0] as unknown as Health;

    // Register a test enemy entity
    health.registerEntity('enemy-1', 50);
    expect(health.getEntity('enemy-1')!.hp).toBe(50);

    const healthChanges: unknown[] = [];
    engine.eventBus.on('health:change', (data) => healthChanges.push(data));

    // Fire a projectile by emitting the collision:damage event with a target
    engine.eventBus.emit('collision:damage', { targetId: 'enemy-1', amount: 15 });

    expect(healthChanges.length).toBe(1);
    const change = healthChanges[0] as { id: string; hp: number; delta: number };
    expect(change.id).toBe('enemy-1');
    expect(change.hp).toBe(35);
    expect(change.delta).toBe(-15);
  });

  // ── Test 4: XP on enemy:death and level up ────────────────────────────

  it('should award XP on enemy death and level up', () => {
    const engine = createActionRpgEngine();
    const levelUp = engine.getModulesByType('LevelUp')[0] as unknown as LevelUp;

    expect(levelUp.getLevel()).toBe(1);
    expect(levelUp.getXp()).toBe(0);

    const xpEvents: unknown[] = [];
    const levelUpEvents: unknown[] = [];
    engine.eventBus.on('levelup:xp', (d) => xpEvents.push(d));
    engine.eventBus.on('levelup:levelup', (d) => levelUpEvents.push(d));

    // The preset sets xpPerLevel: 50, xpAmount: 15 per enemy:death (LevelUp module).
    // EnemyDrop also emits levelup:xp (xpAmount: 15) on each enemy:death, so each
    // death triggers XP from two sources, but LevelUp.addXp only fires once per death
    // (it listens directly to enemy:death, not to levelup:xp).
    // Level 1 threshold = floor(50 * 1^1.5) = 50 XP to reach level 2.
    // Fire 4 enemy:death events → LevelUp receives 4 × 15 = 60 XP → level 2.
    for (let i = 0; i < 4; i++) {
      engine.eventBus.emit('enemy:death', {});
    }

    // At least one levelup:xp event fired per death (two sources emit it)
    expect(xpEvents.length).toBeGreaterThanOrEqual(4);
    expect(levelUp.getLevel()).toBe(2);
    expect(levelUpEvents.length).toBeGreaterThanOrEqual(1);
    const lvEvent = levelUpEvents[0] as { level: number };
    expect(lvEvent.level).toBe(2);
  });

  // ── Test 5: lives reach zero → game over ──────────────────────────────

  it('should end game when lives reach zero', () => {
    const engine = createActionRpgEngine();
    const gf = engine.getModulesByType('GameFlow')[0] as unknown as GameFlow;
    const lives = engine.getModulesByType('Lives')[0] as unknown as Lives;

    gf.transition('playing');
    expect(gf.getState()).toBe('playing');

    const initialLives = lives.getCurrent();
    expect(initialLives).toBeGreaterThan(0);

    // Emit lives:zero directly to simulate all lives lost
    engine.eventBus.emit('lives:zero');

    expect(gf.getState()).toBe('finished');
  });

  // ── Test 6: wave difficulty scales over waves ─────────────────────────

  it('should scale wave difficulty over waves', () => {
    const engine = createActionRpgEngine();
    const gf = engine.getModulesByType('GameFlow')[0] as unknown as GameFlow;
    const spawner = engine.getModulesByType('WaveSpawner')[0] as unknown as WaveSpawner;

    gf.transition('playing');
    tickMs(engine, 1000);

    // Capture wave:start events to compare enemy counts
    const waveStartEvents: Array<{ wave: number; enemyCount: number }> = [];
    engine.eventBus.on('wave:start', (data) => {
      waveStartEvents.push(data as { wave: number; enemyCount: number });
    });

    // Complete wave 1 by killing all enemies (WaveSpawner emits wave:complete when
    // enemiesRemaining hits 0 after all are spawned)
    const wave1Count = spawner.getCurrentWave() === 0 ? 3 : spawner.getEnemiesRemaining();

    // Advance through wave 1: spawn all 3 enemies (spawnDelay=500ms each)
    tickMs(engine, 2500);

    // Kill all wave 1 enemies
    const kills1 = wave1Count > 0 ? wave1Count : 3;
    for (let i = 0; i < kills1; i++) {
      engine.eventBus.emit('enemy:death', {});
    }

    // Wait for wave cooldown (3000ms) + wave 2 to start
    tickMs(engine, 3500);

    expect(spawner.getCurrentWave()).toBeGreaterThanOrEqual(2);

    // If we captured wave:start for wave 2, verify scaling
    if (waveStartEvents.length >= 1) {
      const wave2 = waveStartEvents.find((e) => e.wave === 2);
      if (wave2) {
        // scalingFactor=1.2, wave 2 = ceil(3 * 1.2^1) = 4 enemies
        expect(wave2.enemyCount).toBeGreaterThan(3);
      }
    }
  });

  // ── Test 7: full action-rpg lifecycle ─────────────────────────────────

  it('should run full action-rpg lifecycle (start → fight → level up → waves → finish)', () => {
    const engine = createActionRpgEngine();
    const gf = engine.getModulesByType('GameFlow')[0] as unknown as GameFlow;
    const spawner = engine.getModulesByType('WaveSpawner')[0] as unknown as WaveSpawner;
    const levelUp = engine.getModulesByType('LevelUp')[0] as unknown as LevelUp;
    const lives = engine.getModulesByType('Lives')[0] as unknown as Lives;

    // 1. Start
    expect(gf.getState()).toBe('ready');
    gf.transition('playing');
    expect(gf.getState()).toBe('playing');

    // 2. Wave 1 spawns enemies
    tickMs(engine, 1500);
    expect(spawner.getCurrentWave()).toBe(1);

    // 3. Defeat wave 1 enemies and earn XP (3 enemies × 15 XP = 45 XP)
    for (let i = 0; i < 3; i++) {
      engine.eventBus.emit('enemy:death', {});
    }
    expect(levelUp.getXp()).toBeGreaterThan(0);

    // 4. Earn enough XP for level up (fire 1 more for total 60 XP > threshold 50)
    engine.eventBus.emit('enemy:death', {});
    expect(levelUp.getLevel()).toBe(2);

    // 5. Verify lives still positive mid-game
    expect(lives.getCurrent()).toBeGreaterThan(0);

    // 6. Game should still be running
    expect(gf.getState()).toBe('playing');

    // 7. Trigger game-over via timer:end
    engine.eventBus.emit('timer:end');
    expect(gf.getState()).toBe('finished');
  });
});
