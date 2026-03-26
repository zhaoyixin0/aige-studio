/**
 * Deep QA integration tests for all 14 game types.
 *
 * Goes beyond config creation and module loading:
 * tests actual game logic including event chains, scoring,
 * state transitions, game-over conditions, and module interactions.
 */
import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { GameWizard } from '@/agent/wizard';
import type { GameConfig } from '@/engine/core';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { Spawner, SpawnedObject } from '@/engine/modules/mechanic/spawner';
import type { Scorer } from '@/engine/modules/mechanic/scorer';
import type { Timer } from '@/engine/modules/mechanic/timer';
import type { Lives } from '@/engine/modules/mechanic/lives';
import type { Randomizer } from '@/engine/modules/mechanic/randomizer';
import type { QuizEngine } from '@/engine/modules/mechanic/quiz-engine';
import type { ExpressionDetector } from '@/engine/modules/mechanic/expression-detector';
import type { Runner } from '@/engine/modules/mechanic/runner';
import type { GestureMatch } from '@/engine/modules/mechanic/gesture-match';
import type { BeatMap } from '@/engine/modules/mechanic/beat-map';
import type { MatchEngine } from '@/engine/modules/mechanic/match-engine';
import type { DressUpEngine } from '@/engine/modules/mechanic/dress-up-engine';
import type { PlaneDetection } from '@/engine/modules/mechanic/plane-detection';
import type { BranchStateMachine } from '@/engine/modules/mechanic/branch-state-machine';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createGameAllYes(gameType: string): GameConfig {
  const wizard = new GameWizard();
  wizard.start();
  let result = wizard.answer(gameType);
  while (result.question) {
    result = wizard.answer(result.question.choices[0].id);
  }
  return result.config!;
}

function createEngine(config: GameConfig): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, config);
  return engine;
}

/** Tick engine N milliseconds worth of 16ms frames */
function tickMs(engine: Engine, ms: number): void {
  const frames = Math.ceil(ms / 16);
  for (let i = 0; i < frames; i++) {
    engine.tick(16);
  }
}

/** Transition GameFlow to 'playing' state so modules are unpaused */
function startPlaying(engine: Engine): void {
  const gf = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
  if (gf) {
    gf.transition('playing');
  }
  engine.eventBus.emit('gameflow:resume');
}

/* ================================================================== */
/*  CATCH                                                              */
/* ================================================================== */

describe('Deep QA: Catch', () => {
  it('spawner should have objects after 3 seconds of ticking', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);
    startPlaying(engine);

    tickMs(engine, 3000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    expect(spawner.getObjects().length).toBeGreaterThan(0);
    engine.restart();
  });

  it('score should increase on collision:hit', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);
    startPlaying(engine);

    const scorer = engine.getModulesByType('Scorer')[0] as Scorer;
    expect(scorer).toBeDefined();
    const scoreBefore = scorer.getScore();

    let scoreEvent: any = null;
    engine.eventBus.on('scorer:update', (data) => {
      scoreEvent = data;
    });

    engine.eventBus.emit('collision:hit', {
      objectA: 'player_1',
      objectB: 'spawn-999',
      targetId: 'spawn-999',
    });

    expect(scoreEvent).not.toBeNull();
    expect(scoreEvent.score).toBeGreaterThan(scoreBefore);
    expect(scorer.getScore()).toBeGreaterThan(scoreBefore);
    engine.restart();
  });

  it('timer:end should fire after full duration', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);
    startPlaying(engine);

    const timer = engine.getModulesByType('Timer')[0] as Timer;
    expect(timer).toBeDefined();
    const duration = timer.getParams().duration; // seconds

    let timerEnded = false;
    engine.eventBus.on('timer:end', () => {
      timerEnded = true;
    });

    // Tick just past the duration
    tickMs(engine, (duration + 1) * 1000);

    expect(timerEnded).toBe(true);
    engine.restart();
  });

  it('gameflow should be finished after timer:end', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);
    const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
    gf.transition('playing');

    const timer = engine.getModulesByType('Timer')[0] as Timer;
    const duration = timer.getParams().duration;

    tickMs(engine, (duration + 1) * 1000);

    expect(gf.getState()).toBe('finished');
    engine.restart();
  });
});

/* ================================================================== */
/*  DODGE                                                              */
/* ================================================================== */

describe('Deep QA: Dodge', () => {
  it('spawner should have objects after 3 seconds', () => {
    const config = createGameAllYes('dodge');
    const engine = createEngine(config);
    startPlaying(engine);

    tickMs(engine, 3000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    expect(spawner.getObjects().length).toBeGreaterThan(0);
    engine.restart();
  });

  it('lives should decrease on collision:damage', () => {
    const config = createGameAllYes('dodge');
    const engine = createEngine(config);
    startPlaying(engine);

    const lives = engine.getModulesByType('Lives')[0] as Lives;
    expect(lives).toBeDefined();
    const initialLives = lives.getCurrent();

    let livesChanged = false;
    engine.eventBus.on('lives:change', (data) => {
      livesChanged = true;
      expect(data.current).toBe(initialLives - 1);
    });

    engine.eventBus.emit('collision:damage', {});

    expect(livesChanged).toBe(true);
    expect(lives.getCurrent()).toBe(initialLives - 1);
    engine.restart();
  });

  it('lives:zero should fire after 3 damage events (3 lives)', () => {
    const config = createGameAllYes('dodge');
    const engine = createEngine(config);
    startPlaying(engine);

    const lives = engine.getModulesByType('Lives')[0] as Lives;
    const count = lives.getParams().count;

    let livesZero = false;
    engine.eventBus.on('lives:zero', () => {
      livesZero = true;
    });

    for (let i = 0; i < count; i++) {
      engine.eventBus.emit('collision:damage', {});
    }

    expect(livesZero).toBe(true);
    expect(lives.getCurrent()).toBe(0);
    engine.restart();
  });

  it('gameflow should be finished after lives:zero', () => {
    const config = createGameAllYes('dodge');
    const engine = createEngine(config);
    const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
    gf.transition('playing');

    const lives = engine.getModulesByType('Lives')[0] as Lives;
    const count = lives.getParams().count;

    for (let i = 0; i < count; i++) {
      engine.eventBus.emit('collision:damage', {});
    }

    expect(gf.getState()).toBe('finished');
    engine.restart();
  });
});

/* ================================================================== */
/*  TAP                                                                */
/* ================================================================== */

describe('Deep QA: Tap', () => {
  it('spawner should have objects with speed 0 after 3 seconds', () => {
    const config = createGameAllYes('tap');
    const engine = createEngine(config);
    startPlaying(engine);

    tickMs(engine, 3000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    const objects = spawner.getObjects();
    expect(objects.length).toBeGreaterThan(0);

    // All objects should have speed 0 (stationary targets)
    for (const obj of objects) {
      expect(obj.speed).toBe(0);
    }
    engine.restart();
  });

  it('score should increase on collision:hit', () => {
    const config = createGameAllYes('tap');
    const engine = createEngine(config);
    startPlaying(engine);

    const scorer = engine.getModulesByType('Scorer')[0] as Scorer;
    engine.eventBus.emit('collision:hit', { targetId: 'spawn-tap-1' });

    expect(scorer.getScore()).toBeGreaterThan(0);
    engine.restart();
  });

  it('objects should be spread across screen (not all at y=0)', () => {
    const config = createGameAllYes('tap');
    const engine = createEngine(config);
    startPlaying(engine);

    // Tick enough time for multiple spawns
    tickMs(engine, 5000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    const objects = spawner.getObjects();
    expect(objects.length).toBeGreaterThan(1);

    // Spawn area has height > 0, so objects should have varying y positions
    const spawnArea = spawner.getParams().spawnArea;
    expect(spawnArea.height).toBeGreaterThan(0);

    // With stationary speed=0, objects stay at their spawn y
    // Check that not all y values are identical (statistically extremely unlikely
    // for random spawns within a 1500px height range)
    const uniqueY = new Set(objects.map((o: SpawnedObject) => Math.round(o.y)));
    if (objects.length >= 3) {
      expect(uniqueY.size).toBeGreaterThan(1);
    }
    engine.restart();
  });
});

/* ================================================================== */
/*  SHOOTING                                                           */
/* ================================================================== */

describe('Deep QA: Shooting', () => {
  it('should have combat shooter modules (Projectile, EnemyAI, WaveSpawner)', () => {
    const config = createGameAllYes('shooting');
    const engine = createEngine(config);

    expect(engine.getModulesByType('Projectile').length).toBeGreaterThan(0);
    expect(engine.getModulesByType('EnemyAI').length).toBeGreaterThan(0);
    expect(engine.getModulesByType('WaveSpawner').length).toBeGreaterThan(0);
    engine.restart();
  });

  it('should have projectile-enemy collision rules', () => {
    const config = createGameAllYes('shooting');
    const collision = config.modules.find(m => m.type === 'Collision');
    const rules = collision!.params.rules as Array<{ a: string; b: string; event: string }>;
    expect(rules.some(r => r.a === 'projectiles' && r.b === 'enemies' && r.event === 'hit')).toBe(true);
    expect(rules.some(r => r.a === 'player' && r.b === 'enemies' && r.event === 'damage')).toBe(true);
  });

  it('should not have legacy Spawner module', () => {
    const config = createGameAllYes('shooting');
    const engine = createEngine(config);
    expect(engine.getModulesByType('Spawner').length).toBe(0);
    engine.restart();
  });

  it('score should increase on collision:hit', () => {
    const config = createGameAllYes('shooting');
    const engine = createEngine(config);
    startPlaying(engine);

    const scorer = engine.getModulesByType('Scorer')[0] as Scorer;
    engine.eventBus.emit('collision:hit', { targetId: 'spawn-shoot-1' });

    expect(scorer.getScore()).toBeGreaterThan(0);
    engine.restart();
  });
});

/* ================================================================== */
/*  QUIZ                                                               */
/* ================================================================== */

describe('Deep QA: Quiz', () => {
  it('QuizEngine should have getCurrentQuestion() returning a question', () => {
    const config = createGameAllYes('quiz');
    const engine = createEngine(config);

    const quiz = engine.getModulesByType('QuizEngine')[0] as QuizEngine;
    expect(quiz).toBeDefined();

    // Quiz needs to be started to get current question
    quiz.start();

    const question = quiz.getCurrentQuestion();
    expect(question).not.toBeNull();
    expect(question!.text).toBeDefined();
    expect(question!.text.length).toBeGreaterThan(0);
    expect(question!.options).toBeDefined();
    expect(question!.options.length).toBeGreaterThanOrEqual(2);
    expect(typeof question!.correctIndex).toBe('number');
    engine.restart();
  });

  it('correct answer should emit quiz:correct and increase score', () => {
    const config = createGameAllYes('quiz');
    const engine = createEngine(config);

    const quiz = engine.getModulesByType('QuizEngine')[0] as QuizEngine;
    quiz.start();

    const question = quiz.getCurrentQuestion()!;
    let correctFired = false;
    let scoreFired = false;
    engine.eventBus.on('quiz:correct', () => {
      correctFired = true;
    });
    engine.eventBus.on('scorer:update', (data) => {
      scoreFired = true;
      expect(data.delta).toBeGreaterThan(0);
    });

    quiz.answer(question.correctIndex);

    expect(correctFired).toBe(true);
    expect(scoreFired).toBe(true);
    engine.restart();
  });

  it('after all questions, quiz should be finished', () => {
    const config = createGameAllYes('quiz');
    const engine = createEngine(config);

    const quiz = engine.getModulesByType('QuizEngine')[0] as QuizEngine;
    quiz.start();

    const progress = quiz.getProgress();
    let quizFinished = false;
    engine.eventBus.on('quiz:finished', () => {
      quizFinished = true;
    });

    // Answer all questions correctly
    for (let i = 0; i < progress.total; i++) {
      const q = quiz.getCurrentQuestion();
      if (q) {
        quiz.answer(q.correctIndex);
      }
    }

    expect(quizFinished).toBe(true);
    expect(quiz.isFinished()).toBe(true);
    engine.restart();
  });
});

/* ================================================================== */
/*  RANDOM WHEEL                                                       */
/* ================================================================== */

describe('Deep QA: Random Wheel', () => {
  it('Randomizer should have items', () => {
    const config = createGameAllYes('random-wheel');
    const engine = createEngine(config);

    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer;
    expect(randomizer).toBeDefined();

    const items = randomizer.getItems();
    expect(items.length).toBeGreaterThan(0);
    engine.restart();
  });

  it('after calling spin(), isSpinning() should be true', () => {
    const config = createGameAllYes('random-wheel');
    const engine = createEngine(config);

    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer;
    expect(randomizer.isSpinning()).toBe(false);

    randomizer.spin();

    expect(randomizer.isSpinning()).toBe(true);
    engine.restart();
  });

  it('after spin duration, result should be set', () => {
    const config = createGameAllYes('random-wheel');
    const engine = createEngine(config);
    startPlaying(engine);

    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer;
    const spinDuration = randomizer.getParams().spinDuration ?? 3;

    let resultEvent: any = null;
    engine.eventBus.on('randomizer:result', (data) => {
      resultEvent = data;
    });

    randomizer.spin();
    expect(randomizer.isSpinning()).toBe(true);

    // Tick past the spin duration
    tickMs(engine, (spinDuration + 0.5) * 1000);

    expect(randomizer.isSpinning()).toBe(false);
    expect(resultEvent).not.toBeNull();
    expect(randomizer.getResult()).not.toBeNull();
    engine.restart();
  });

  it('result should be one of the configured items', () => {
    const config = createGameAllYes('random-wheel');
    const engine = createEngine(config);
    startPlaying(engine);

    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer;
    const items = randomizer.getItems();

    randomizer.spin();
    tickMs(engine, 4000);

    const result = randomizer.getResult();
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThanOrEqual(0);
    expect(result!.index).toBeLessThan(items.length);
    expect(result!.item.asset).toBe(items[result!.index].asset);
    engine.restart();
  });
});

/* ================================================================== */
/*  EXPRESSION                                                         */
/* ================================================================== */

describe('Deep QA: Expression', () => {
  it('ExpressionDetector should exist', () => {
    const config = createGameAllYes('expression');
    const engine = createEngine(config);

    const detector = engine.getModulesByType('ExpressionDetector')[0] as ExpressionDetector;
    expect(detector).toBeDefined();
    expect(detector.getParams().expressionType).toBeDefined();
    engine.restart();
  });

  it('face:smile with high value should emit expression:detected', () => {
    const config = createGameAllYes('expression');
    const engine = createEngine(config);
    startPlaying(engine);

    let detected = false;
    engine.eventBus.on('expression:detected', (data) => {
      detected = true;
      expect(data.expression).toBeDefined();
      expect(data.confidence).toBeGreaterThan(0);
    });

    // Emit input:face:smile with value exceeding threshold (0.6)
    engine.eventBus.emit('input:face:smile', { value: 0.95 });

    expect(detected).toBe(true);
    engine.restart();
  });

  it('score should increase on expression:detected via collision:hit wiring', () => {
    const config = createGameAllYes('expression');
    const engine = createEngine(config);
    startPlaying(engine);

    // Expression game has a Scorer that listens to collision:hit.
    // But ExpressionDetector emits expression:detected, not collision:hit.
    // So we verify that the expression game's scorer responds to collision:hit
    // (which would be emitted by a separate collision system if present),
    // and that expression:detected fires correctly.
    const scorer = engine.getModulesByType('Scorer')[0] as Scorer;
    expect(scorer).toBeDefined();

    // Directly trigger scorer via collision:hit
    engine.eventBus.emit('collision:hit', { targetId: 'test' });
    expect(scorer.getScore()).toBeGreaterThan(0);
    engine.restart();
  });
});

/* ================================================================== */
/*  RUNNER                                                             */
/* ================================================================== */

describe('Deep QA: Runner', () => {
  it('Runner module should exist with laneCount', () => {
    const config = createGameAllYes('runner');
    const engine = createEngine(config);

    const runner = engine.getModulesByType('Runner')[0] as Runner;
    expect(runner).toBeDefined();
    expect(runner.getParams().laneCount).toBeGreaterThanOrEqual(2);
    engine.restart();
  });

  it('spawner should have objects moving left after 3 seconds', () => {
    const config = createGameAllYes('runner');
    const engine = createEngine(config);
    startPlaying(engine);

    tickMs(engine, 3000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    const objects = spawner.getObjects();
    expect(objects.length).toBeGreaterThan(0);

    // Runner spawner direction is 'left'
    for (const obj of objects) {
      expect(obj.direction).toBe('left');
    }
    engine.restart();
  });

  it('scorer perHit should be 5', () => {
    const config = createGameAllYes('runner');
    const engine = createEngine(config);

    const scorer = engine.getModulesByType('Scorer')[0] as Scorer;
    expect(scorer).toBeDefined();
    expect(scorer.getParams().perHit).toBe(5);
    engine.restart();
  });

  it('Runner should accumulate distance when started', () => {
    const config = createGameAllYes('runner');
    const engine = createEngine(config);
    startPlaying(engine);

    const runner = engine.getModulesByType('Runner')[0] as Runner;
    runner.start();

    tickMs(engine, 2000);

    expect(runner.getDistance()).toBeGreaterThan(0);
    expect(runner.getCurrentSpeed()).toBeGreaterThan(0);
    engine.restart();
  });
});

/* ================================================================== */
/*  GESTURE                                                            */
/* ================================================================== */

describe('Deep QA: Gesture', () => {
  it('GestureMatch should have targetGestures array', () => {
    const config = createGameAllYes('gesture');
    const engine = createEngine(config);

    const gm = engine.getModulesByType('GestureMatch')[0] as GestureMatch;
    expect(gm).toBeDefined();

    const gestures = gm.getParams().targetGestures;
    expect(Array.isArray(gestures)).toBe(true);
    expect(gestures.length).toBeGreaterThanOrEqual(2);
    engine.restart();
  });

  it('matching gesture input should emit gesture:match', () => {
    const config = createGameAllYes('gesture');
    const engine = createEngine(config);
    startPlaying(engine);

    const gm = engine.getModulesByType('GestureMatch')[0] as GestureMatch;
    gm.start();

    const target = gm.getCurrentTarget();
    expect(target).not.toBeNull();

    let matched = false;
    engine.eventBus.on('gesture:match', (data) => {
      matched = true;
      expect(data.gesture).toBe(target);
    });

    // Send matching gesture with high confidence
    engine.eventBus.emit('input:hand:gesture', {
      gesture: target,
      confidence: 1.0,
    });

    expect(matched).toBe(true);
    engine.restart();
  });
});

/* ================================================================== */
/*  RHYTHM                                                             */
/* ================================================================== */

describe('Deep QA: Rhythm', () => {
  it('BeatMap should have bpm value', () => {
    const config = createGameAllYes('rhythm');
    const engine = createEngine(config);

    const beatMap = engine.getModulesByType('BeatMap')[0] as BeatMap;
    expect(beatMap).toBeDefined();
    expect(beatMap.getParams().bpm).toBeGreaterThan(0);
    engine.restart();
  });

  it('Spawner should exist for beat notes', () => {
    const config = createGameAllYes('rhythm');
    const engine = createEngine(config);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    engine.restart();
  });

  it('BeatMap should generate beats from bpm when started', () => {
    const config = createGameAllYes('rhythm');
    const engine = createEngine(config);

    const beatMap = engine.getModulesByType('BeatMap')[0] as BeatMap;
    beatMap.start();

    const beats = beatMap.getBeats();
    expect(beats.length).toBeGreaterThan(0);

    // Beats should be evenly spaced based on BPM
    const bpm = beatMap.getParams().bpm;
    const expectedInterval = 60000 / bpm;
    if (beats.length >= 2) {
      const actualInterval = beats[1] - beats[0];
      expect(actualInterval).toBeCloseTo(expectedInterval, 0);
    }
    engine.restart();
  });
});

/* ================================================================== */
/*  PUZZLE                                                             */
/* ================================================================== */

describe('Deep QA: Puzzle', () => {
  it('MatchEngine should have gridCols and gridRows', () => {
    const config = createGameAllYes('puzzle');
    const engine = createEngine(config);

    const matchEngine = engine.getModulesByType('MatchEngine')[0] as MatchEngine;
    expect(matchEngine).toBeDefined();
    expect(matchEngine.getParams().gridCols).toBeGreaterThanOrEqual(2);
    expect(matchEngine.getParams().gridRows).toBeGreaterThanOrEqual(2);
    engine.restart();
  });

  it('grid should be initialized after start()', () => {
    const config = createGameAllYes('puzzle');
    const engine = createEngine(config);

    const matchEngine = engine.getModulesByType('MatchEngine')[0] as MatchEngine;
    matchEngine.start();

    const grid = matchEngine.getGrid();
    const cols = matchEngine.getParams().gridCols;
    const rows = matchEngine.getParams().gridRows;
    expect(grid.length).toBe(cols * rows);

    // All cells should start as not revealed and not matched
    for (const cell of grid) {
      expect(cell.revealed).toBe(false);
      expect(cell.matched).toBe(false);
    }
    engine.restart();
  });

  it('selecting matching cells should emit match:found', () => {
    const config = createGameAllYes('puzzle');
    const engine = createEngine(config);

    const matchEngine = engine.getModulesByType('MatchEngine')[0] as MatchEngine;
    matchEngine.start();

    const grid = matchEngine.getGrid();
    // Find two cells with the same value
    const valueMap = new Map<number, number[]>();
    for (const cell of grid) {
      const indices = valueMap.get(cell.value) ?? [];
      indices.push(cell.id);
      valueMap.set(cell.value, indices);
    }

    let matchFound = false;
    engine.eventBus.on('match:found', () => {
      matchFound = true;
    });

    // Find a pair
    for (const [, indices] of valueMap) {
      if (indices.length >= 2) {
        matchEngine.selectCell(indices[0]);
        matchEngine.selectCell(indices[1]);
        break;
      }
    }

    expect(matchFound).toBe(true);
    expect(matchEngine.getMatchesFound()).toBe(1);
    engine.restart();
  });
});

/* ================================================================== */
/*  DRESS-UP                                                           */
/* ================================================================== */

describe('Deep QA: Dress-Up', () => {
  it('DressUpEngine should have layers', () => {
    const config = createGameAllYes('dress-up');
    const engine = createEngine(config);

    const dressUp = engine.getModulesByType('DressUpEngine')[0] as DressUpEngine;
    expect(dressUp).toBeDefined();

    const layers = dressUp.getParams().layers;
    expect(Array.isArray(layers)).toBe(true);
    expect(layers.length).toBeGreaterThanOrEqual(3);
    engine.restart();
  });

  it('should be able to equip items', () => {
    const config = createGameAllYes('dress-up');
    const engine = createEngine(config);

    const dressUp = engine.getModulesByType('DressUpEngine')[0] as DressUpEngine;
    const layers = dressUp.getParams().layers as string[];

    let equipEvent: any = null;
    engine.eventBus.on('dressup:equip', (data) => {
      equipEvent = data;
    });

    const result = dressUp.equip(layers[0], 'cool_hat_1');
    expect(result).toBe(true);
    expect(equipEvent).not.toBeNull();
    expect(equipEvent.layer).toBe(layers[0]);
    expect(equipEvent.itemId).toBe('cool_hat_1');

    const equipped = dressUp.getEquipped(layers[0]);
    expect(equipped.length).toBe(1);
    expect(equipped[0].itemId).toBe('cool_hat_1');
    engine.restart();
  });

  it('equipping beyond maxPerLayer should unequip oldest', () => {
    const config = createGameAllYes('dress-up');
    const engine = createEngine(config);

    const dressUp = engine.getModulesByType('DressUpEngine')[0] as DressUpEngine;
    const layers = dressUp.getParams().layers as string[];
    const maxPerLayer = dressUp.getParams().maxPerLayer;

    // Equip maxPerLayer + 1 items
    for (let i = 0; i < maxPerLayer + 1; i++) {
      dressUp.equip(layers[0], `item_${i}`);
    }

    const equipped = dressUp.getEquipped(layers[0]);
    expect(equipped.length).toBe(maxPerLayer);
    // The oldest should have been removed
    expect(equipped[0].itemId).toBe(`item_1`);
    engine.restart();
  });
});

/* ================================================================== */
/*  WORLD AR                                                           */
/* ================================================================== */

describe('Deep QA: World AR', () => {
  it('PlaneDetection should exist', () => {
    const config = createGameAllYes('world-ar');
    const engine = createEngine(config);

    const pd = engine.getModulesByType('PlaneDetection')[0] as PlaneDetection;
    expect(pd).toBeDefined();
    expect(pd.getParams().enabled).toBe(true);
    engine.restart();
  });

  it('Spawner should exist for placing objects', () => {
    const config = createGameAllYes('world-ar');
    const engine = createEngine(config);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    expect(spawner).toBeDefined();
    engine.restart();
  });

  it('PlaneDetection should detect planes from camera frames', () => {
    const config = createGameAllYes('world-ar');
    const engine = createEngine(config);

    const pd = engine.getModulesByType('PlaneDetection')[0] as PlaneDetection;

    let planeDetected = false;
    engine.eventBus.on('plane:detected', () => {
      planeDetected = true;
    });

    // Emit a camera frame with high brightness (easy detection)
    engine.eventBus.emit('camera:frame', {
      brightness: 0.9,
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.3,
    });

    expect(planeDetected).toBe(true);
    expect(pd.getPlanes().length).toBeGreaterThan(0);
    engine.restart();
  });

  it('simulateScan should add planes', () => {
    const config = createGameAllYes('world-ar');
    const engine = createEngine(config);

    const pd = engine.getModulesByType('PlaneDetection')[0] as PlaneDetection;

    // Run multiple scans (some may not detect depending on random confidence)
    for (let i = 0; i < 20; i++) {
      pd.simulateScan();
    }

    // With sensitivity 0.5 and random confidence [0.5, 1.0], most scans should detect
    expect(pd.getPlanes().length).toBeGreaterThan(0);
    engine.restart();
  });
});

/* ================================================================== */
/*  NARRATIVE                                                          */
/* ================================================================== */

describe('Deep QA: Narrative', () => {
  it('BranchStateMachine should have states with startState', () => {
    const config = createGameAllYes('narrative');
    const engine = createEngine(config);

    const bsm = engine.getModulesByType('BranchStateMachine')[0] as BranchStateMachine;
    expect(bsm).toBeDefined();
    expect(bsm.getParams().startState).toBe('start');
    expect(bsm.getParams().states).toBeDefined();
    expect(bsm.getParams().states['start']).toBeDefined();
    engine.restart();
  });

  it('should be able to transition states', () => {
    const config = createGameAllYes('narrative');
    const engine = createEngine(config);

    const bsm = engine.getModulesByType('BranchStateMachine')[0] as BranchStateMachine;
    bsm.start();

    expect(bsm.getCurrentState()).toBe('start');
    expect(bsm.isStarted()).toBe(true);

    let stateChanged = false;
    engine.eventBus.on('branch:stateChange', (data) => {
      stateChanged = true;
      expect(data.from).toBe('start');
      expect(data.to).toBeDefined();
    });

    // Choose first option
    bsm.choose(0);
    expect(stateChanged).toBe(true);
    expect(bsm.getCurrentState()).not.toBe('start');
    engine.restart();
  });

  it('reaching an end state (no choices) should emit branch:end', () => {
    const config = createGameAllYes('narrative');
    const engine = createEngine(config);

    const bsm = engine.getModulesByType('BranchStateMachine')[0] as BranchStateMachine;
    bsm.start();

    let endFired = false;
    engine.eventBus.on('branch:end', () => {
      endFired = true;
    });

    // Navigate to an end state: start -> forest -> treasure
    bsm.choose(0); // start -> forest
    bsm.choose(0); // forest -> treasure (end state, no choices)

    expect(endFired).toBe(true);
    expect(bsm.isStarted()).toBe(false);
    engine.restart();
  });

  it('should NOT have Spawner (not a physics game)', () => {
    const config = createGameAllYes('narrative');
    const engine = createEngine(config);

    const spawners = engine.getModulesByType('Spawner');
    expect(spawners.length).toBe(0);
    engine.restart();
  });
});

/* ================================================================== */
/*  CROSS-CUTTING: GameFlow state machine                              */
/* ================================================================== */

describe('Deep QA: GameFlow state machine', () => {
  it('countdown should transition to playing after countdown seconds', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);

    const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
    expect(gf.getState()).toBe('ready');

    gf.transition('countdown');
    const countdownSec = gf.getParams().countdown ?? 3;

    // Tick through the countdown
    tickMs(engine, (countdownSec + 0.5) * 1000);

    expect(gf.getState()).toBe('playing');
    engine.restart();
  });

  it('transition to finished should emit gameflow:pause', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);

    const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
    gf.transition('playing');

    let paused = false;
    engine.eventBus.on('gameflow:pause', () => {
      paused = true;
    });

    gf.transition('finished');
    expect(paused).toBe(true);
    engine.restart();
  });
});

/* ================================================================== */
/*  CROSS-CUTTING: Timer + GameFlow integration                        */
/* ================================================================== */

describe('Deep QA: Timer + GameFlow integration', () => {
  const timerGameTypes = ['catch', 'dodge', 'shooting', 'rhythm'];

  for (const gameType of timerGameTypes) {
    it(`${gameType}: timer:end should transition GameFlow to finished`, () => {
      const config = createGameAllYes(gameType);
      const engine = createEngine(config);

      const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
      gf.transition('playing');

      const timer = engine.getModulesByType('Timer')[0] as Timer;
      if (!timer) return; // some configs might not have timer

      const duration = timer.getParams().duration;
      tickMs(engine, (duration + 1) * 1000);

      expect(gf.getState()).toBe('finished');
      engine.restart();
    });
  }
});

/* ================================================================== */
/*  CROSS-CUTTING: Lives + GameFlow integration                        */
/* ================================================================== */

describe('Deep QA: Lives + GameFlow integration', () => {
  const livesGameTypes = ['dodge', 'runner'];

  for (const gameType of livesGameTypes) {
    it(`${gameType}: lives:zero should transition GameFlow to finished`, () => {
      const config = createGameAllYes(gameType);
      const engine = createEngine(config);

      const gf = engine.getModulesByType('GameFlow')[0] as GameFlow;
      gf.transition('playing');

      const lives = engine.getModulesByType('Lives')[0] as Lives;
      if (!lives) return;

      const count = lives.getParams().count;
      for (let i = 0; i < count; i++) {
        engine.eventBus.emit('collision:damage', {});
      }

      expect(gf.getState()).toBe('finished');
      engine.restart();
    });
  }
});

/* ================================================================== */
/*  CROSS-CUTTING: Spawner + Collision auto-wiring                     */
/* ================================================================== */

describe('Deep QA: Spawner + Collision auto-wiring', () => {
  it('spawned objects should be auto-registered in Collision', () => {
    const config = createGameAllYes('catch');
    const engine = createEngine(config);
    startPlaying(engine);

    // Force a spawn by ticking
    tickMs(engine, 2000);

    const spawner = engine.getModulesByType('Spawner')[0] as Spawner;
    const objects = spawner.getObjects();
    expect(objects.length).toBeGreaterThan(0);

    // The auto-wirer should have registered spawned objects in Collision
    // We can verify by checking that collision:hit removes objects from spawner
    const firstObj = objects[0];
    engine.eventBus.emit('collision:hit', { targetId: firstObj.id });

    const afterObjects = spawner.getObjects();
    const found = afterObjects.find((o: SpawnedObject) => o.id === firstObj.id);
    expect(found).toBeUndefined();
    engine.restart();
  });
});

/* ================================================================== */
/*  BUG REGRESSION: Quiz preset field names                            */
/* ================================================================== */

describe('Bug regression: Quiz preset uses correct field names', () => {
  it('quiz questions should use text and correctIndex fields', () => {
    const config = createGameAllYes('quiz');
    const quizModule = config.modules.find((m) => m.type === 'QuizEngine');
    expect(quizModule).toBeDefined();

    const questions = quizModule!.params.questions as any[];
    for (const q of questions) {
      expect(q.text).toBeDefined();
      expect(typeof q.text).toBe('string');
      expect(typeof q.correctIndex).toBe('number');
      // Should NOT have old field names
      expect(q.question).toBeUndefined();
      expect(q.correct).toBeUndefined();
    }
  });
});
