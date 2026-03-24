import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig } from '@/engine/core';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { Scorer } from '@/engine/modules/mechanic/scorer';
import type { Timer } from '@/engine/modules/mechanic/timer';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';


/**
 * Shooting game config: targets appear, player shoots them.
 * DifficultyRamp increases spawner frequency over time.
 * Modules: Scorer, Timer, Spawner, Collision, DifficultyRamp, GameFlow
 */
const SHOOTING_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Shooting Test', description: 'Integration test shooting game', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 25 } },
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 20, mode: 'countdown' } },
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: {
        frequency: 2.0,
        maxCount: 15,
        items: [{ asset: 'target', weight: 1 }],
        direction: 'down',
        speed: { min: 100, max: 150 },
        spawnArea: { x: 50, y: 0, width: 980, height: 0 },
      },
    },
    {
      id: 'collision_1',
      type: 'Collision',
      enabled: true,
      params: {
        rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
      },
    },
    {
      id: 'difficulty_1',
      type: 'DifficultyRamp',
      enabled: true,
      params: {
        target: 'spawner_1',
        mode: 'time',
        rules: [
          { every: 5, field: 'frequency', decrease: 0.3, min: 0.5 },
        ],
      },
    },
    { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: { countdown: 0 } },
  ],
  assets: {},
};

function createShootingEngine(): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, SHOOTING_CONFIG);
  return engine;
}

describe('Shooting Game Integration', () => {
  it('should load all 6 modules from config', () => {
    const engine = createShootingEngine();

    expect(engine.getAllModules().length).toBe(6);
    expect(engine.getModule('scorer_1')).toBeDefined();
    expect(engine.getModule('timer_1')).toBeDefined();
    expect(engine.getModule('spawner_1')).toBeDefined();
    expect(engine.getModule('collision_1')).toBeDefined();
    expect(engine.getModule('difficulty_1')).toBeDefined();
    expect(engine.getModule('gameflow_1')).toBeDefined();
  });

  it('should verify module types are correct', () => {
    const engine = createShootingEngine();

    expect(engine.getModule('scorer_1')!.type).toBe('Scorer');
    expect(engine.getModule('timer_1')!.type).toBe('Timer');
    expect(engine.getModule('spawner_1')!.type).toBe('Spawner');
    expect(engine.getModule('collision_1')!.type).toBe('Collision');
    expect(engine.getModule('difficulty_1')!.type).toBe('DifficultyRamp');
    expect(engine.getModule('gameflow_1')!.type).toBe('GameFlow');
  });

  it('should spawn targets over time', () => {
    const engine = createShootingEngine();
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    gameflow.transition('countdown');

    // Initially no objects
    expect(spawner.getObjects().length).toBe(0);

    // Tick 5 seconds (frequency=2s, so should spawn ~2 targets)
    for (let i = 0; i < 50; i++) {
      engine.tick(100);
    }

    expect(spawner.getObjects().length).toBeGreaterThan(0);
  });

  it('should increase score by 25 per hit', () => {
    const engine = createShootingEngine();
    const scorer = engine.getModule('scorer_1') as unknown as Scorer;

    expect(scorer.getScore()).toBe(0);

    engine.eventBus.emit('collision:hit', { targetId: 'target_1' });
    expect(scorer.getScore()).toBe(25);

    engine.eventBus.emit('collision:hit', { targetId: 'target_2' });
    expect(scorer.getScore()).toBe(50);

    engine.eventBus.emit('collision:hit', { targetId: 'target_3' });
    expect(scorer.getScore()).toBe(75);
  });

  it('should increase difficulty over time by decreasing spawner frequency', () => {
    const engine = createShootingEngine();
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;
    const gameflow = engine.getModule('gameflow_1') as any;
    gameflow.transition('countdown');

    // Initial frequency is 2.0s
    const initialFrequency = spawner.getParams().frequency;
    expect(initialFrequency).toBe(2.0);

    // Tick 5.1 seconds — DifficultyRamp should trigger once (every: 5s)
    // Using slightly more than 5s to avoid floating-point boundary issues
    for (let i = 0; i < 51; i++) {
      engine.tick(100);
    }

    // Frequency should have decreased by 0.3 (from 2.0 to 1.7)
    const afterFirstRamp = spawner.getParams().frequency;
    expect(afterFirstRamp).toBeCloseTo(1.7, 1);

    // Tick another 5 seconds (total ~10.1s)
    for (let i = 0; i < 50; i++) {
      engine.tick(100);
    }

    // Frequency should have decreased again (from 1.7 to 1.4)
    const afterSecondRamp = spawner.getParams().frequency;
    expect(afterSecondRamp).toBeCloseTo(1.4, 1);
  });

  it('should clamp difficulty at minimum value', () => {
    const engine = createShootingEngine();
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;

    // Tick a long time — frequency should not go below 0.5 (the min)
    // Starting at 2.0, decreasing 0.3 every 5s, reaches 0.5 after ~25s
    for (let i = 0; i < 400; i++) {
      engine.tick(100); // 40 seconds total
    }

    const finalFrequency = spawner.getParams().frequency;
    expect(finalFrequency).toBeGreaterThanOrEqual(0.5);
  });

  it('should emit difficulty:update events on ramp', () => {
    const engine = createShootingEngine();
    const gameflow = engine.getModule('gameflow_1') as any;
    gameflow.transition('countdown');
    const difficultyEvents: any[] = [];

    engine.eventBus.on('difficulty:update', (data) => {
      difficultyEvents.push(data);
    });

    // Tick 11 seconds — should trigger difficulty at 5s and 10s
    for (let i = 0; i < 110; i++) {
      engine.tick(100);
    }

    expect(difficultyEvents.length).toBeGreaterThanOrEqual(2);
    expect(difficultyEvents[0].field).toBe('frequency');
    expect(difficultyEvents[0].target).toBe('spawner_1');
  });

  it('should end game when timer expires', () => {
    const engine = createShootingEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;

    // Start game
    gameflow.transition('playing');
    expect(gameflow.getState()).toBe('playing');

    let timerEnded = false;
    engine.eventBus.on('timer:end', () => {
      timerEnded = true;
    });

    // Tick 21 seconds (timer is 20s)
    for (let i = 0; i < 210; i++) {
      engine.tick(100);
    }

    expect(timerEnded).toBe(true);
    expect(gameflow.getState()).toBe('finished');
  });

  it('should run full shooting game lifecycle', () => {
    const engine = createShootingEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    const scorer = engine.getModule('scorer_1') as unknown as Scorer;
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;
    const timer = engine.getModule('timer_1') as unknown as Timer;

    // 1. Start game
    gameflow.transition('playing');
    expect(gameflow.getState()).toBe('playing');

    // 2. Play for 5.5 seconds — score some hits and let difficulty ramp
    // Using slightly more than 5s to ensure DifficultyRamp triggers
    for (let i = 0; i < 55; i++) {
      engine.tick(100);
    }
    expect(spawner.getObjects().length).toBeGreaterThan(0);

    // Shoot some targets
    engine.eventBus.emit('collision:hit', { targetId: 't1' });
    engine.eventBus.emit('collision:hit', { targetId: 't2' });
    expect(scorer.getScore()).toBe(50);

    // 3. Difficulty should have ramped (frequency decreased from 2.0)
    expect(spawner.getParams().frequency).toBeLessThan(2.0);

    // 4. Play until timer ends (remaining ~14.5s)
    for (let i = 0; i < 155; i++) {
      engine.tick(100);
    }

    // 5. Game should be finished
    expect(gameflow.getState()).toBe('finished');
    expect(timer.getRemaining()).toBe(0);
    expect(scorer.getScore()).toBe(50);
  });

  it('should pause spawner and timer when game finishes', () => {
    const engine = createShootingEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    const timer = engine.getModule('timer_1') as unknown as Timer;

    gameflow.transition('playing');

    // Tick 5 seconds
    for (let i = 0; i < 50; i++) {
      engine.tick(100);
    }

    const elapsedBeforeFinish = timer.getElapsed();

    // Finish the game
    gameflow.transition('finished');

    // Tick more - timer should be paused (GameFlow emits gameflow:pause on finish)
    for (let i = 0; i < 50; i++) {
      engine.tick(100);
    }

    // Timer should not have advanced further (paused)
    expect(timer.getElapsed()).toBe(elapsedBeforeFinish);
  });
});
