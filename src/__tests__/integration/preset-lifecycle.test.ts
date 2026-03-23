import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { GameWizard } from '@/agent/wizard';

describe('Preset Lifecycle', () => {
  const GAME_TYPES = ['catch', 'dodge', 'tap', 'shooting', 'quiz', 'runner', 'expression', 'random-wheel', 'gesture', 'rhythm', 'puzzle', 'dress-up', 'world-ar', 'narrative'];

  for (const gameType of GAME_TYPES) {
    it(`should load ${gameType} preset into engine without errors`, () => {
      const wizard = new GameWizard();
      wizard.start();
      let result = wizard.answer(gameType);

      // Auto-answer remaining wizard steps with first available choice
      while (result.question) {
        const firstChoice = result.question.choices[0].id;
        result = wizard.answer(firstChoice);
      }

      expect(result.config).not.toBeNull();
      const config = result.config!;
      expect(config.modules.length).toBeGreaterThan(0);

      // Load into engine — should not throw
      const engine = new Engine();
      const registry = createModuleRegistry();
      const loader = new ConfigLoader(registry);

      expect(() => loader.load(engine, config)).not.toThrow();
      expect(engine.getAllModules().length).toBeGreaterThan(0);

      // Tick several frames to verify no runtime errors in update loops
      for (let i = 0; i < 30; i++) {
        expect(() => engine.tick(16)).not.toThrow();
      }

      engine.restart();
    });
  }

  // Wizard output regression test: verify calibrated values actually appear
  it('catch preset should use calibrated spawner speed', () => {
    const wizard = new GameWizard();
    wizard.start();
    let result = wizard.answer('catch');
    while (result.question) {
      result = wizard.answer(result.question.choices[0].id);
    }
    const config = result.config!;
    const spawner = config.modules.find(m => m.type === 'Spawner');
    expect(spawner).toBeDefined();
    expect((spawner!.params as any).speed?.min).toBe(200);
    expect((spawner!.params as any).speed?.max).toBe(300);
  });

  it('shooting preset should use random spawn direction', () => {
    const wizard = new GameWizard();
    wizard.start();
    let result = wizard.answer('shooting');
    while (result.question) {
      result = wizard.answer(result.question.choices[0].id);
    }
    const config = result.config!;
    const spawner = config.modules.find(m => m.type === 'Spawner');
    expect(spawner).toBeDefined();
    expect((spawner!.params as any).direction).toBe('random');
  });

  it('runner preset should use perHit=5 for scoring', () => {
    const wizard = new GameWizard();
    wizard.start();
    let result = wizard.answer('runner');
    while (result.question) {
      result = wizard.answer(result.question.choices[0].id);
    }
    const config = result.config!;
    const scorer = config.modules.find(m => m.type === 'Scorer');
    expect(scorer).toBeDefined();
    expect((scorer!.params as any).perHit).toBe(5);
  });
});
