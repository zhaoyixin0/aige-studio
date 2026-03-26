import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { ALL_GAME_TYPES, getGamePreset } from '@/agent/game-presets';
import type { GameConfig, ModuleConfig } from '@/engine/core';

// Helper: build a GameConfig from a preset
function buildConfig(gameType: string): GameConfig {
  const preset = getGamePreset(gameType);
  if (!preset) throw new Error(`No preset found for game type: ${gameType}`);
  const modules: ModuleConfig[] = Object.entries(preset).map(([type, params], i) => ({
    id: `${type.toLowerCase()}_${i}`,
    type,
    enabled: true,
    params: params as Record<string, any>,
  }));
  return {
    version: '1.0.0',
    meta: { name: gameType, description: '', thumbnail: null, createdAt: new Date().toISOString(), theme: 'fruit' },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

// Helper: create engine with config loaded
function createEngine(gameType: string): Engine {
  const engine = new Engine();
  const registry = createModuleRegistry();
  const loader = new ConfigLoader(registry);
  loader.load(engine, buildConfig(gameType));
  return engine;
}

// Helper: tick engine for N ms
function tickMs(engine: Engine, ms: number) {
  const frames = Math.ceil(ms / 16);
  for (let i = 0; i < frames; i++) engine.tick(16);
}

for (const gameType of ALL_GAME_TYPES) {
  describe(`${gameType} lifecycle`, () => {
    it('loads all modules without errors', () => {
      const engine = createEngine(gameType);
      expect(engine.getAllModules().length).toBeGreaterThan(0);
      engine.restart();
    });

    it('starts countdown → playing transition', () => {
      const engine = createEngine(gameType);
      const gf = engine.getModulesByType('GameFlow')[0] as any;
      if (!gf) { engine.restart(); return; }

      expect(gf.getState()).toBe('ready');
      gf.transition('countdown');

      // Some game types have countdown=0, which transitions directly to playing
      const countdownSeconds = gf.getParams().countdown ?? 3;
      if (countdownSeconds <= 0) {
        expect(gf.getState()).toBe('playing');
      } else {
        // Tick through countdown (max 5s)
        tickMs(engine, 6000);
        expect(gf.getState()).toBe('playing');
      }
      engine.restart();
    });

    it('handles timer:end → finished', () => {
      const engine = createEngine(gameType);
      const gf = engine.getModulesByType('GameFlow')[0] as any;
      if (!gf) { engine.restart(); return; }

      gf.transition('playing');
      engine.eventBus.emit('timer:end');
      expect(gf.getState()).toBe('finished');
      engine.restart();
    });

    it('handles lives:zero → finished', () => {
      const engine = createEngine(gameType);
      const gf = engine.getModulesByType('GameFlow')[0] as any;
      if (!gf) { engine.restart(); return; }

      gf.transition('playing');
      engine.eventBus.emit('lives:zero');
      expect(gf.getState()).toBe('finished');
      engine.restart();
    });

    it('runs 5 seconds of gameplay without errors', () => {
      const engine = createEngine(gameType);
      const gf = engine.getModulesByType('GameFlow')[0] as any;
      if (gf) gf.transition('playing');

      // Should not throw during 5s of gameplay
      expect(() => tickMs(engine, 5000)).not.toThrow();
      engine.restart();
    });

    it('restarts cleanly after finish', () => {
      const engine = createEngine(gameType);
      const gf = engine.getModulesByType('GameFlow')[0] as any;
      if (!gf) { engine.restart(); return; }

      // Play → finish → reset → play again
      gf.transition('playing');
      engine.eventBus.emit('timer:end');
      expect(gf.getState()).toBe('finished');

      // Reset all modules that have a reset method
      for (const mod of engine.getAllModules()) {
        if (typeof (mod as any).reset === 'function') {
          (mod as any).reset();
        }
      }
      gf.transition('playing');
      expect(gf.getState()).toBe('playing');

      // Should run without errors after restart
      expect(() => tickMs(engine, 2000)).not.toThrow();
      engine.restart();
    });
  });
}
