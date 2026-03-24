import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { EventRecorder, ModuleDiagnostics, CombinationGenerator } from '@/engine/diagnostics';

const testCases = CombinationGenerator.fromPresets();

function runDiagnostics(tc: typeof testCases[0]) {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  const recorder = new EventRecorder();

  loader.load(engine, tc.config);
  recorder.attach(engine.eventBus);

  // Start game
  const gf = engine.getModulesByType('GameFlow')[0] as any;
  if (gf) gf.transition('playing');

  // Simulate 3 seconds of gameplay
  for (let i = 0; i < 187; i++) { // ~3s at 16ms/frame
    engine.tick(16);
    recorder.tick();
  }

  const report = ModuleDiagnostics.diagnose(engine, recorder, tc.config);
  recorder.detach();
  engine.restart();
  return report;
}

describe('Module Combination Diagnostics', () => {
  // Group: baselines must not crash
  // Note: dependency errors are allowed since some game types (quiz, expression, etc.)
  // intentionally omit Collision from presets while Scorer still declares it as required.
  describe('baseline presets', () => {
    const baselines = testCases.filter(tc => tc.variant === 'baseline');
    for (const tc of baselines) {
      it(`${tc.name} — no crashes`, () => {
        const report = runDiagnostics(tc);
        const crashes = report.errors.filter(e => e.category === 'crash');
        if (crashes.length > 0) {
          console.log(ModuleDiagnostics.formatReport(report));
        }
        expect(crashes).toHaveLength(0);
      });
    }
  });

  // Group: remove variants should not crash
  describe('remove variants', () => {
    const removes = testCases.filter(tc => tc.variant === 'remove');
    for (const tc of removes) {
      it(`${tc.name} — no crashes`, () => {
        const report = runDiagnostics(tc);
        const crashes = report.errors.filter(e => e.category === 'crash');
        if (crashes.length > 0) {
          console.log(ModuleDiagnostics.formatReport(report));
        }
        expect(crashes).toHaveLength(0);
      });
    }
  });

  // Group: add variants should not crash
  describe('add variants', () => {
    const adds = testCases.filter(tc => tc.variant === 'add');
    for (const tc of adds) {
      it(`${tc.name} — no crashes`, () => {
        const report = runDiagnostics(tc);
        const crashes = report.errors.filter(e => e.category === 'crash');
        if (crashes.length > 0) {
          console.log(ModuleDiagnostics.formatReport(report));
        }
        expect(crashes).toHaveLength(0);
      });
    }
  });
});
