import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { ModuleRegistry } from '../module-registry';
import { ConfigLoader } from '../config-loader';
import type { GameConfig } from '../types';
import { Scorer } from '@/engine/modules/mechanic/scorer';
import { Timer } from '@/engine/modules/mechanic/timer';
import { Lives } from '@/engine/modules/mechanic/lives';

describe('ConfigLoader', () => {
  it('should load config: enable Scorer and Timer, skip disabled Lives', () => {
    const registry = new ModuleRegistry();
    registry.register('Scorer', Scorer);
    registry.register('Timer', Timer);
    registry.register('Lives', Lives);

    const engine = new Engine();
    const loader = new ConfigLoader(registry);

    const config: GameConfig = {
      version: '1.0.0',
      meta: {
        name: 'Test Game',
        description: '',
        thumbnail: null,
        createdAt: new Date().toISOString(),
      },
      canvas: { width: 800, height: 600 },
      modules: [
        { id: 'scorer-1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
        { id: 'timer-1', type: 'Timer', enabled: true, params: { mode: 'countdown', duration: 30 } },
        { id: 'lives-1', type: 'Lives', enabled: false, params: { count: 3 } },
      ],
      assets: {},
    };

    loader.load(engine, config);

    // Scorer and Timer should be in the engine
    expect(engine.getModule('scorer-1')).toBeDefined();
    expect(engine.getModule('scorer-1')!.type).toBe('Scorer');

    expect(engine.getModule('timer-1')).toBeDefined();
    expect(engine.getModule('timer-1')!.type).toBe('Timer');

    // Lives should NOT be in the engine (disabled)
    expect(engine.getModule('lives-1')).toBeUndefined();
  });
});
