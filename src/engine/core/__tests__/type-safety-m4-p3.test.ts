/**
 * M4 Phase 3: Verify BaseModule internal params are unknown (no any isolation layer).
 */
import { describe, it, expect } from 'vitest';
import { Engine } from '../engine';
import { ConfigLoader } from '../config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig } from '../types';

describe('M4 Phase 3 — BaseModule params unknown', () => {
  it('module.getParams() returns Record<string, unknown>', () => {
    const engine = new Engine();
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry);

    const config: GameConfig = {
      version: '1.0',
      modules: [
        { id: 'timer', type: 'Timer', enabled: true, params: { duration: 30 } },
      ],
      assets: {},
      canvas: { width: 1080, height: 1920 },
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    };

    loader.load(engine, config);
    const timer = engine.getModule('timer')!;
    const params = timer.getParams();

    // params.duration is unknown — must narrow before use
    expect(typeof params.duration).toBe('number');
    const duration = params.duration as number;
    expect(duration).toBe(30);
  });

  it('module.configure() accepts Record<string, unknown>', () => {
    const engine = new Engine();
    const registry = createModuleRegistry();
    const loader = new ConfigLoader(registry);

    const config: GameConfig = {
      version: '1.0',
      modules: [
        { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
      assets: {},
      canvas: { width: 1080, height: 1920 },
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    };

    loader.load(engine, config);
    const scorer = engine.getModule('scorer')!;

    // configure with unknown params
    const updates: Record<string, unknown> = { perHit: 25 };
    scorer.configure(updates);

    expect(scorer.getParams().perHit).toBe(25);
  });
});
