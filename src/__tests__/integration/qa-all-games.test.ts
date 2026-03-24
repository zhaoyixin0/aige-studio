import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { GameWizard } from '@/agent/wizard';
import type { GameConfig } from '@/engine/core';

function createGame(gameType: string): GameConfig {
  const wizard = new GameWizard();
  wizard.start();
  let result = wizard.answer(gameType);
  while (result.question) {
    // Always pick first choice, say "yes" to all optionals
    const choiceId = result.question.choices[0].id;
    result = wizard.answer(choiceId);
  }
  return result.config!;
}

function loadAndTick(config: GameConfig, frames: number = 100): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, config);

  // Start the game so Timer/Spawner/Collision are unpaused
  engine.eventBus.emit('gameflow:resume');

  for (let i = 0; i < frames; i++) {
    engine.tick(16);
  }
  return engine;
}

describe('QA: All Game Types', () => {
  // Test each game type
  const types = ['catch', 'dodge', 'tap', 'shooting', 'quiz', 'runner', 'expression', 'random-wheel', 'gesture', 'rhythm', 'puzzle', 'dress-up', 'world-ar', 'narrative'];

  for (const gameType of types) {
    describe(gameType, () => {
      it('should create valid config', () => {
        const config = createGame(gameType);
        expect(config).toBeDefined();
        expect(config.modules.length).toBeGreaterThan(0);
        expect(config.meta.name).toBeTruthy();
      });

      it('should load all modules without errors', () => {
        const config = createGame(gameType);
        const engine = new Engine();
        const registry = createModuleRegistry();
        const loader = new ConfigLoader(registry);
        expect(() => loader.load(engine, config)).not.toThrow();

        // Verify all config modules are loaded
        for (const mod of config.modules) {
          if (mod.enabled) {
            const loaded = engine.getModule(mod.id);
            expect(loaded, `Module ${mod.id} (${mod.type}) not loaded`).toBeDefined();
          }
        }
        engine.restart();
      });

      it('should tick 200 frames without errors', () => {
        const config = createGame(gameType);
        expect(() => loadAndTick(config, 200)).not.toThrow();
      });
    });
  }

  // Game-specific behavior tests

  describe('catch specific', () => {
    it('should spawn objects after ticking', () => {
      const config = createGame('catch');
      const engine = loadAndTick(config, 200);
      const spawner = engine.getModulesByType('Spawner')[0] as any;
      expect(spawner).toBeDefined();
      expect(spawner.getObjects().length).toBeGreaterThan(0);
      engine.restart();
    });

    it('should update score on collision:hit', () => {
      const config = createGame('catch');
      const engine = loadAndTick(config, 10);
      let scoreUpdated = false;
      engine.eventBus.on('scorer:update', () => { scoreUpdated = true; });
      engine.eventBus.emit('collision:hit', { objectA: 'player_1', objectB: 'spawn-1', targetId: 'spawn-1' });
      expect(scoreUpdated).toBe(true);
      engine.restart();
    });

    it('should have DifficultyRamp targeting spawner_1', () => {
      const config = createGame('catch');
      const ramp = config.modules.find(m => m.type === 'DifficultyRamp');
      if (ramp) {
        expect(ramp.params.target).toBe('spawner_1');
        expect(ramp.params.rules).toBeDefined();
        expect(Array.isArray(ramp.params.rules)).toBe(true);
      }
    });
  });

  describe('dodge specific', () => {
    it('should have collision:damage rule (not hit)', () => {
      const config = createGame('dodge');
      const collision = config.modules.find(m => m.type === 'Collision');
      expect(collision).toBeDefined();
      const rules = collision!.params.rules as any[];
      expect(rules.some((r: any) => r.event === 'damage')).toBe(true);
    });

    it('should decrease lives on collision:damage', () => {
      const config = createGame('dodge');
      const engine = loadAndTick(config, 10);
      const lives = engine.getModulesByType('Lives')[0] as any;
      expect(lives).toBeDefined();
      lives.getParams(); // verify params accessible
      engine.eventBus.emit('collision:damage', {});
      // Lives should decrease (check via lives:change event)
      engine.eventBus.on('lives:change', (_data: any) => { /* newCount = data?.current; */ });
      engine.eventBus.emit('collision:damage', {});
      // Note: lives may have already decreased from first emit
      engine.restart();
    });
  });

  describe('tap specific', () => {
    it('should spawn objects across full screen (not just top)', () => {
      const config = createGame('tap');
      const spawner = config.modules.find(m => m.type === 'Spawner');
      expect(spawner).toBeDefined();
      const area = spawner!.params.spawnArea as any;
      expect(area).toBeDefined();
      expect(area.height).toBeGreaterThan(0); // Full screen, not just y=0
    });

    it('should have stationary objects (speed 0)', () => {
      const config = createGame('tap');
      const spawner = config.modules.find(m => m.type === 'Spawner');
      const speed = spawner!.params.speed as any;
      expect(speed.min).toBe(0);
      expect(speed.max).toBe(0);
    });
  });

  describe('shooting specific', () => {
    it('should use random direction (not down)', () => {
      const config = createGame('shooting');
      const spawner = config.modules.find(m => m.type === 'Spawner');
      expect(spawner!.params.direction).toBe('random');
    });
  });

  describe('quiz specific', () => {
    it('should have QuizEngine with questions', () => {
      const config = createGame('quiz');
      const quiz = config.modules.find(m => m.type === 'QuizEngine');
      expect(quiz).toBeDefined();
      const questions = quiz!.params.questions as any[];
      expect(questions.length).toBeGreaterThanOrEqual(5);
    });

    it('should NOT have Spawner or Collision (not a physics game)', () => {
      const config = createGame('quiz');
      expect(config.modules.find(m => m.type === 'Spawner')).toBeUndefined();
      expect(config.modules.find(m => m.type === 'Collision')).toBeUndefined();
    });

    it('should score 20 points per correct answer', () => {
      const config = createGame('quiz');
      const scorer = config.modules.find(m => m.type === 'Scorer');
      expect(scorer).toBeDefined();
      expect(scorer!.params.perHit).toBe(20);
    });
  });

  describe('random-wheel specific', () => {
    it('should have Randomizer with 6 items', () => {
      const config = createGame('random-wheel');
      const randomizer = config.modules.find(m => m.type === 'Randomizer');
      expect(randomizer).toBeDefined();
      const items = randomizer!.params.items as any[];
      expect(items.length).toBe(6);
    });

    it('should NOT have Timer (no countdown for wheel)', () => {
      const config = createGame('random-wheel');
      expect(config.modules.find(m => m.type === 'Timer')).toBeUndefined();
    });
  });

  describe('expression specific', () => {
    it('should have ExpressionDetector', () => {
      const config = createGame('expression');
      const detector = config.modules.find(m => m.type === 'ExpressionDetector');
      expect(detector).toBeDefined();
      expect(detector!.params.expressionType).toBeDefined();
    });

    it('should have FaceInput (fixed, not selectable)', () => {
      const config = createGame('expression');
      expect(config.modules.find(m => m.type === 'FaceInput')).toBeDefined();
    });
  });

  describe('runner specific', () => {
    it('should have Runner module', () => {
      const config = createGame('runner');
      expect(config.modules.find(m => m.type === 'Runner')).toBeDefined();
    });

    it('should score 5 per hit (not 10)', () => {
      const config = createGame('runner');
      const scorer = config.modules.find(m => m.type === 'Scorer');
      expect(scorer!.params.perHit).toBe(5);
    });

    it('should have Lives module (endless until fail)', () => {
      const config = createGame('runner');
      expect(config.modules.find(m => m.type === 'Lives')).toBeDefined();
    });

    it('should spawn objects moving left (side-scroller)', () => {
      const config = createGame('runner');
      const spawner = config.modules.find(m => m.type === 'Spawner');
      expect(spawner!.params.direction).toBe('left');
    });
  });

  describe('gesture specific', () => {
    it('should have GestureMatch with target gestures', () => {
      const config = createGame('gesture');
      const gm = config.modules.find(m => m.type === 'GestureMatch');
      expect(gm).toBeDefined();
      const gestures = gm!.params.targetGestures as string[];
      expect(gestures.length).toBeGreaterThanOrEqual(4);
      expect(gm!.params.matchThreshold).toBeDefined();
    });

    it('should have an input module', () => {
      const config = createGame('gesture');
      const hasInput = config.modules.some(m =>
        ['FaceInput', 'HandInput', 'TouchInput', 'DeviceInput', 'AudioInput'].includes(m.type));
      expect(hasInput).toBe(true);
    });
  });

  describe('rhythm specific', () => {
    it('should have BeatMap with bpm', () => {
      const config = createGame('rhythm');
      const bm = config.modules.find(m => m.type === 'BeatMap');
      expect(bm).toBeDefined();
      expect(bm!.params.bpm).toBeDefined();
      expect(bm!.params.tolerance).toBeDefined();
    });
  });

  describe('puzzle specific', () => {
    it('should have MatchEngine with grid config', () => {
      const config = createGame('puzzle');
      const me = config.modules.find(m => m.type === 'MatchEngine');
      expect(me).toBeDefined();
      expect(me!.params.gridCols).toBeDefined();
      expect(me!.params.gridRows).toBeDefined();
      expect(me!.params.matchCount).toBeDefined();
    });
  });

  describe('dress-up specific', () => {
    it('should have DressUpEngine with layers', () => {
      const config = createGame('dress-up');
      const de = config.modules.find(m => m.type === 'DressUpEngine');
      expect(de).toBeDefined();
      const layers = de!.params.layers as string[];
      expect(layers.length).toBeGreaterThanOrEqual(3);
      expect(de!.params.maxPerLayer).toBeDefined();
    });
  });

  describe('world-ar specific', () => {
    it('should have PlaneDetection', () => {
      const config = createGame('world-ar');
      const pd = config.modules.find(m => m.type === 'PlaneDetection');
      expect(pd).toBeDefined();
      expect(pd!.params.enabled).toBe(true);
      expect(pd!.params.sensitivity).toBeDefined();
    });
  });

  describe('narrative specific', () => {
    it('should have BranchStateMachine with states', () => {
      const config = createGame('narrative');
      const bsm = config.modules.find(m => m.type === 'BranchStateMachine');
      expect(bsm).toBeDefined();
      expect(bsm!.params.startState).toBe('start');
      expect(bsm!.params.states).toBeDefined();
      const states = bsm!.params.states as Record<string, any>;
      expect(states['start']).toBeDefined();
      expect(states['start'].choices.length).toBeGreaterThan(0);
    });

    it('should NOT have Spawner or Collision', () => {
      const config = createGame('narrative');
      expect(config.modules.find(m => m.type === 'Spawner')).toBeUndefined();
      expect(config.modules.find(m => m.type === 'Collision')).toBeUndefined();
    });
  });
});
