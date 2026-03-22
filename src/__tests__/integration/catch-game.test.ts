import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig } from '@/engine/core';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { Scorer } from '@/engine/modules/mechanic/scorer';
import type { Timer } from '@/engine/modules/mechanic/timer';
import type { Lives } from '@/engine/modules/mechanic/lives';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { UIOverlay } from '@/engine/modules/feedback/ui-overlay';
import type { ResultScreen } from '@/engine/modules/feedback/result-screen';

/**
 * Full catch-game config: objects fall from the top, player catches them.
 * Modules: Scorer, Timer, Lives, Spawner, Collision, GameFlow, UIOverlay, ResultScreen
 */
const CATCH_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Catch Test', description: 'Integration test catch game', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30, mode: 'countdown' } },
    { id: 'lives_1', type: 'Lives', enabled: true, params: { count: 3 } },
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: {
        frequency: 0.5,
        maxCount: 10,
        items: [{ asset: 'star', weight: 1 }],
        direction: 'down',
        speed: { min: 200, max: 200 },
        spawnArea: { x: 100, y: 0, width: 800, height: 0 },
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
    { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: { countdown: 0 } },
    { id: 'overlay_1', type: 'UIOverlay', enabled: true, params: {} },
    { id: 'result_1', type: 'ResultScreen', enabled: true, params: {} },
  ],
  assets: {},
};

function createCatchEngine(): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, CATCH_CONFIG);
  return engine;
}

describe('Catch Game Integration', () => {
  it('should load all 8 modules from config', () => {
    const engine = createCatchEngine();

    expect(engine.getAllModules().length).toBe(8);
    expect(engine.getModule('scorer_1')).toBeDefined();
    expect(engine.getModule('timer_1')).toBeDefined();
    expect(engine.getModule('lives_1')).toBeDefined();
    expect(engine.getModule('spawner_1')).toBeDefined();
    expect(engine.getModule('collision_1')).toBeDefined();
    expect(engine.getModule('gameflow_1')).toBeDefined();
    expect(engine.getModule('overlay_1')).toBeDefined();
    expect(engine.getModule('result_1')).toBeDefined();
  });

  it('should have correct module types', () => {
    const engine = createCatchEngine();

    expect(engine.getModule('scorer_1')!.type).toBe('Scorer');
    expect(engine.getModule('timer_1')!.type).toBe('Timer');
    expect(engine.getModule('lives_1')!.type).toBe('Lives');
    expect(engine.getModule('spawner_1')!.type).toBe('Spawner');
    expect(engine.getModule('collision_1')!.type).toBe('Collision');
    expect(engine.getModule('gameflow_1')!.type).toBe('GameFlow');
    expect(engine.getModule('overlay_1')!.type).toBe('UIOverlay');
    expect(engine.getModule('result_1')!.type).toBe('ResultScreen');
  });

  it('should spawn objects over time', () => {
    const engine = createCatchEngine();
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;

    // Initially no objects
    expect(spawner.getObjects().length).toBe(0);

    // Tick enough time for spawner to create objects (frequency=0.5s)
    for (let i = 0; i < 20; i++) {
      engine.tick(100); // 100ms per tick, 2 seconds total
    }

    // After 2 seconds at 0.5s frequency, should have spawned ~4 objects
    expect(spawner.getObjects().length).toBeGreaterThan(0);
  });

  it('should increase score on collision:hit events', () => {
    const engine = createCatchEngine();
    const scorer = engine.getModule('scorer_1') as unknown as Scorer;

    // Score starts at 0
    expect(scorer.getScore()).toBe(0);

    // Emit collision hit (as if player caught an object)
    engine.eventBus.emit('collision:hit', { objectA: 'player_1', objectB: 'obj_1', targetId: 'obj_1' });
    expect(scorer.getScore()).toBe(10);

    // Another hit
    engine.eventBus.emit('collision:hit', { objectA: 'player_1', objectB: 'obj_2', targetId: 'obj_2' });
    expect(scorer.getScore()).toBe(20);
  });

  it('should emit scorer:update when score changes', () => {
    const engine = createCatchEngine();
    let lastScoreUpdate: any = null;

    engine.eventBus.on('scorer:update', (data) => {
      lastScoreUpdate = data;
    });

    engine.eventBus.emit('collision:hit', {});
    expect(lastScoreUpdate).not.toBeNull();
    expect(lastScoreUpdate.score).toBe(10);
    expect(lastScoreUpdate.delta).toBe(10);
  });

  it('should count down timer and emit timer:end', () => {
    const engine = createCatchEngine();
    const timer = engine.getModule('timer_1') as unknown as Timer;

    let timerEnded = false;
    engine.eventBus.on('timer:end', () => {
      timerEnded = true;
    });

    // Timer is 30 seconds. Tick 31 seconds worth
    for (let i = 0; i < 310; i++) {
      engine.tick(100);
    }

    expect(timerEnded).toBe(true);
    expect(timer.getRemaining()).toBe(0);
  });

  it('should emit timer:tick events every second', () => {
    const engine = createCatchEngine();
    const tickEvents: any[] = [];

    engine.eventBus.on('timer:tick', (data) => {
      tickEvents.push(data);
    });

    // Tick 3 seconds
    for (let i = 0; i < 30; i++) {
      engine.tick(100);
    }

    // Should have 3 tick events (at 1s, 2s, 3s)
    expect(tickEvents.length).toBe(3);
    // In countdown mode, remaining should decrease
    expect(tickEvents[0].remaining).toBe(29);
    expect(tickEvents[1].remaining).toBe(28);
    expect(tickEvents[2].remaining).toBe(27);
  });

  it('should lose lives on collision:damage and detect lives:zero', () => {
    const engine = createCatchEngine();
    const lives = engine.getModule('lives_1') as unknown as Lives;

    let livesZero = false;
    engine.eventBus.on('lives:zero', () => {
      livesZero = true;
    });

    expect(lives.getCurrent()).toBe(3);

    // Take 3 damage events
    engine.eventBus.emit('collision:damage', {});
    expect(lives.getCurrent()).toBe(2);

    engine.eventBus.emit('collision:damage', {});
    expect(lives.getCurrent()).toBe(1);

    engine.eventBus.emit('collision:damage', {});
    expect(lives.getCurrent()).toBe(0);

    expect(livesZero).toBe(true);
  });

  it('should transition GameFlow to finished on timer:end', () => {
    const engine = createCatchEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;

    // Start the game by transitioning to playing
    gameflow.transition('playing');
    expect(gameflow.getState()).toBe('playing');

    // Simulate timer ending
    engine.eventBus.emit('timer:end');
    expect(gameflow.getState()).toBe('finished');
  });

  it('should transition GameFlow to finished on lives:zero', () => {
    const engine = createCatchEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;

    gameflow.transition('playing');
    expect(gameflow.getState()).toBe('playing');

    // Simulate all lives lost
    engine.eventBus.emit('lives:zero');
    expect(gameflow.getState()).toBe('finished');
  });

  it('should pause spawner when game finishes', () => {
    const engine = createCatchEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    const spawner = engine.getModule('spawner_1') as unknown as Spawner;

    // Start playing
    gameflow.transition('playing');

    // Let spawner create some objects
    for (let i = 0; i < 20; i++) {
      engine.tick(100);
    }
    const countBeforeFinish = spawner.getObjects().length;
    expect(countBeforeFinish).toBeGreaterThan(0);

    // Finish the game - this emits gameflow:pause which pauses the spawner
    gameflow.transition('finished');

    // Record count right after finishing
    const countAfterFinish = spawner.getObjects().length;

    // Tick more, but spawner should be paused and not create new objects
    // (existing objects may move off screen and be removed, so count shouldn't increase)
    for (let i = 0; i < 20; i++) {
      engine.tick(100);
    }

    expect(spawner.getObjects().length).toBeLessThanOrEqual(countAfterFinish);
  });

  it('should show ResultScreen when game finishes', () => {
    const engine = createCatchEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    const resultScreen = engine.getModule('result_1') as unknown as ResultScreen;

    expect(resultScreen.isVisible()).toBe(false);

    // Start and then finish the game
    gameflow.transition('playing');

    // Score some points first
    engine.eventBus.emit('collision:hit', {});
    engine.eventBus.emit('collision:hit', {});

    // Finish the game
    gameflow.transition('finished');

    expect(resultScreen.isVisible()).toBe(true);
    const results = resultScreen.getResults();
    expect(results.stats.score).toBe(20);
  });

  it('should update UIOverlay HUD state on scorer:update', () => {
    const engine = createCatchEngine();
    const overlay = engine.getModule('overlay_1') as unknown as UIOverlay;

    // Initially score in HUD is 0
    expect(overlay.getHudState().score).toBe(0);

    // Score some points
    engine.eventBus.emit('collision:hit', {});
    expect(overlay.getHudState().score).toBe(10);

    engine.eventBus.emit('collision:hit', {});
    expect(overlay.getHudState().score).toBe(20);
  });

  it('should update UIOverlay HUD state on timer:tick', () => {
    const engine = createCatchEngine();
    const overlay = engine.getModule('overlay_1') as unknown as UIOverlay;

    // Tick 1 second
    engine.tick(1000);

    const hud = overlay.getHudState();
    expect(hud.timer.remaining).toBe(29);
    expect(hud.timer.elapsed).toBe(1);
  });

  it('should run a full game lifecycle: start → play → finish', () => {
    const engine = createCatchEngine();
    const gameflow = engine.getModule('gameflow_1') as unknown as GameFlow;
    const scorer = engine.getModule('scorer_1') as unknown as Scorer;
    const resultScreen = engine.getModule('result_1') as unknown as ResultScreen;

    // 1. Start game (countdown=0 means direct to playing)
    gameflow.transition('countdown');
    // With countdown=0 it skips directly to playing
    expect(gameflow.getState()).toBe('playing');

    // 2. Play: score some points and tick
    for (let i = 0; i < 5; i++) {
      engine.eventBus.emit('collision:hit', {});
    }
    expect(scorer.getScore()).toBe(50);

    // 3. Tick the full 30 seconds to trigger timer:end
    for (let i = 0; i < 300; i++) {
      engine.tick(100);
    }

    // 4. Game should have finished via timer:end → GameFlow transition
    expect(gameflow.getState()).toBe('finished');

    // 5. Result screen should be visible with final score
    expect(resultScreen.isVisible()).toBe(true);
    expect(resultScreen.getResults().stats.score).toBe(50);
  });
});
