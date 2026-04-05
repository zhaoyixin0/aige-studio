import { describe, it, expect } from 'vitest';
import { PresetRegistry } from '../preset-registry';
import { RecipeExecutor } from '../recipe-executor';
import { validateParamValue } from '../validators';
import type { GameConfig } from '../../../core/types';
import type { PresetTemplate, ParamSpec } from '../types';

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

// ── Full slingshot game template ──

const SLINGSHOT_TEMPLATE: PresetTemplate = {
  id: 'slingshot-game',
  title: 'Slingshot Launch',
  description: 'Pull back and release to launch projectiles at structures',
  gameType: 'slingshot',
  tags: ['physics', 'aim', 'casual'],
  params: [
    { name: 'gravity', type: 'number', default: 9.8, min: 1, max: 30, description: 'Gravity strength' },
    { name: 'projectileSpeed', type: 'number', default: 15, min: 5, max: 50 },
    { name: 'hasTimer', type: 'boolean', default: true },
    { name: 'timerDuration', type: 'number', default: 60, min: 15, max: 120 },
    { name: 'theme', type: 'enum', enumValues: ['fruit', 'space', 'ocean'], default: 'fruit' },
  ],
  sequence: {
    id: 'slingshot-seq',
    commands: [
      { name: 'setMeta', args: { name: 'Slingshot Game', theme: '$theme' } },
      { name: 'configureCanvas', args: { width: 1080, height: 1920 } },
      { name: 'addModule', args: { type: 'Physics2D', id: 'Physics2D_1', params: { gravityY: '$gravity' } } },
      { name: 'addModule', args: { type: 'Collision', id: 'Collision_1', params: {} } },
      { name: 'addModule', args: { type: 'Projectile', id: 'Projectile_1', params: { speed: '$projectileSpeed' } } },
      { name: 'addModule', args: { type: 'Aim', id: 'Aim_1', params: {} } },
      { name: 'addModule', args: { type: 'Scorer', id: 'Scorer_1', params: {} } },
      { name: 'addModule', args: { type: 'Timer', id: 'Timer_1', params: { duration: '$timerDuration' } }, when: 'hasTimer' },
      { name: 'addModule', args: { type: 'TouchInput', id: 'TouchInput_1', params: {} } },
      { name: 'addModule', args: { type: 'GameFlow', id: 'GameFlow_1', params: {} } },
      { name: 'addAsset', args: { assetId: 'projectile', type: 'sprite', src: 'projectile.png' } },
    ],
  },
  requiredModules: ['Physics2D', 'Collision', 'Projectile', 'Aim', 'Scorer', 'TouchInput', 'GameFlow'],
};

describe('Recipe Runner Integration', () => {
  it('end-to-end: register template → validate params → execute → verify config', () => {
    // 1. Register
    const registry = new PresetRegistry();
    registry.register(SLINGSHOT_TEMPLATE);
    expect(registry.size()).toBe(1);

    // 2. Look up by game type
    const templates = registry.findByGameType('slingshot');
    expect(templates).toHaveLength(1);
    const template = templates[0];

    // 3. Fill params (user provides values, validate against ParamSpec)
    const userParams: Record<string, unknown> = {
      gravity: 12,
      projectileSpeed: 20,
      hasTimer: true,
      timerDuration: 90,
      theme: 'space',
    };

    for (const spec of template.params) {
      const val = userParams[spec.name] ?? spec.default;
      const vr = validateParamValue(spec, val);
      expect(vr.valid, `Param ${spec.name} failed: ${vr.errors.map((e) => e.message).join()}`).toBe(true);
    }

    // 4. Execute
    const result = RecipeExecutor.execute(template.sequence, makeEmptyConfig(), userParams);
    expect(result.success).toBe(true);

    // 5. Verify config
    const config = result.config;

    // Meta
    expect(config.meta.name).toBe('Slingshot Game');
    expect(config.meta.theme).toBe('space');

    // Canvas
    expect(config.canvas.width).toBe(1080);
    expect(config.canvas.height).toBe(1920);

    // Modules — 8 total (Physics2D, Collision, Projectile, Aim, Scorer, Timer, TouchInput, GameFlow)
    expect(config.modules).toHaveLength(8);
    const types = config.modules.map((m) => m.type);
    expect(types).toContain('Physics2D');
    expect(types).toContain('Timer');

    // Param substitution worked
    const physics = config.modules.find((m) => m.type === 'Physics2D')!;
    expect(physics.params.gravityY).toBe(12);

    const timer = config.modules.find((m) => m.type === 'Timer')!;
    expect(timer.params.duration).toBe(90);

    // Assets
    expect(config.assets.projectile).toEqual({ type: 'sprite', src: 'projectile.png' });

    // Created list
    expect(result.created).toHaveLength(8);
  });

  it('skips Timer when hasTimer=false', () => {
    const result = RecipeExecutor.execute(
      SLINGSHOT_TEMPLATE.sequence,
      makeEmptyConfig(),
      { gravity: 9.8, projectileSpeed: 15, hasTimer: false, timerDuration: 60, theme: 'fruit' },
    );
    expect(result.success).toBe(true);
    expect(result.config.modules).toHaveLength(7); // no Timer
    expect(result.config.modules.map((m) => m.type)).not.toContain('Timer');
  });

  it('rejects invalid param values before execution', () => {
    const spec: ParamSpec = { name: 'gravity', type: 'number', min: 1, max: 30 };
    const vr = validateParamValue(spec, 999);
    expect(vr.valid).toBe(false);
  });

  it('builds a catch game with default params', () => {
    const CATCH_TEMPLATE: PresetTemplate = {
      id: 'catch-simple',
      title: 'Simple Catch',
      gameType: 'catch',
      tags: ['casual'],
      params: [
        { name: 'spawnRate', type: 'number', default: 2 },
      ],
      sequence: {
        id: 'catch-seq',
        commands: [
          { name: 'setMeta', args: { name: 'Catch Game' } },
          { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: { frequency: '$spawnRate' } } },
          { name: 'addModule', args: { type: 'Collision', id: 'Collision_1', params: {} } },
          { name: 'addModule', args: { type: 'Scorer', id: 'Scorer_1', params: {} } },
          { name: 'addModule', args: { type: 'TouchInput', id: 'Touch_1', params: {} } },
          { name: 'addModule', args: { type: 'GameFlow', id: 'GF_1', params: {} } },
        ],
      },
    };

    // Use defaults
    const defaults: Record<string, unknown> = {};
    for (const p of CATCH_TEMPLATE.params) {
      if (p.default !== undefined) defaults[p.name] = p.default;
    }

    const result = RecipeExecutor.execute(CATCH_TEMPLATE.sequence, makeEmptyConfig(), defaults);
    expect(result.success).toBe(true);
    expect(result.config.modules).toHaveLength(5);
    expect(result.config.modules[0].params.frequency).toBe(2);
  });

  it('template modification: add module then tweak params', () => {
    const config = makeEmptyConfig();
    config.modules = [
      { id: 'Spawner_1', type: 'Spawner', enabled: true, params: { frequency: 1 } },
    ];

    const tweakSeq = {
      id: 'tweak',
      commands: [
        { name: 'addModule' as const, args: { type: 'Tween', id: 'Tween_1', params: {} } },
        { name: 'setParam' as const, args: { moduleId: 'Spawner_1', param: 'frequency', value: 3 } },
        { name: 'batchSetParams' as const, args: { moduleId: 'Tween_1', params: { timeScale: 1.5 } } },
      ],
    };

    const result = RecipeExecutor.execute(tweakSeq, config, {});
    expect(result.success).toBe(true);
    expect(result.config.modules).toHaveLength(2);
    expect(result.config.modules[0].params.frequency).toBe(3);
    expect(result.config.modules[1].params.timeScale).toBe(1.5);
  });

  it('rollback preserves original config on mid-sequence failure', () => {
    const config = makeEmptyConfig();
    config.modules = [
      { id: 'Existing_1', type: 'Timer', enabled: true, params: { duration: 30 } },
    ];

    const failSeq = {
      id: 'fail-mid',
      commands: [
        { name: 'addModule' as const, args: { type: 'Spawner', id: 'S1', params: {} } },
        { name: 'setParam' as const, args: { moduleId: 'S1', param: 'speed', value: 5 } },
        { name: 'removeModule' as const, args: { id: 'GHOST' } }, // fails here
      ],
    };

    const result = RecipeExecutor.execute(failSeq, config, {});
    expect(result.success).toBe(false);
    // Config should be clean — original preserved
    expect(result.config.modules).toHaveLength(1);
    expect(result.config.modules[0].id).toBe('Existing_1');
  });
});
