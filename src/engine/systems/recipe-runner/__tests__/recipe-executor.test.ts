import { describe, it, expect } from 'vitest';
import { RecipeExecutor } from '../recipe-executor';
import type { GameConfig } from '../../../core/types';
import type { CommandSequence } from '../types';

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

describe('RecipeExecutor', () => {
  // ── addModule ──

  describe('addModule', () => {
    it('adds a module to config', () => {
      const seq: CommandSequence = {
        id: 'add-spawner',
        commands: [
          { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: { speed: 5 } } },
        ],
      };
      const config = makeEmptyConfig();
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.success).toBe(true);
      expect(result.config.modules).toHaveLength(1);
      expect(result.config.modules[0].type).toBe('Spawner');
      expect(result.config.modules[0].id).toBe('Spawner_1');
      expect(result.config.modules[0].enabled).toBe(true);
      expect(result.config.modules[0].params.speed).toBe(5);
    });

    it('does not mutate the original config', () => {
      const seq: CommandSequence = {
        id: 'add',
        commands: [
          { name: 'addModule', args: { type: 'Timer', id: 'Timer_1', params: {} } },
        ],
      };
      const config = makeEmptyConfig();
      const result = RecipeExecutor.execute(seq, config, {});
      expect(config.modules).toHaveLength(0);
      expect(result.config.modules).toHaveLength(1);
    });

    it('adds multiple modules in sequence', () => {
      const seq: CommandSequence = {
        id: 'multi',
        commands: [
          { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: {} } },
          { name: 'addModule', args: { type: 'Collision', id: 'Collision_1', params: {} } },
          { name: 'addModule', args: { type: 'Scorer', id: 'Scorer_1', params: {} } },
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.success).toBe(true);
      expect(result.config.modules).toHaveLength(3);
      expect(result.created).toEqual(['Spawner_1', 'Collision_1', 'Scorer_1']);
    });
  });

  // ── removeModule ──

  describe('removeModule', () => {
    it('removes a module by id', () => {
      const config = makeEmptyConfig();
      config.modules = [
        { id: 'Spawner_1', type: 'Spawner', enabled: true, params: {} },
        { id: 'Timer_1', type: 'Timer', enabled: true, params: {} },
      ];
      const seq: CommandSequence = {
        id: 'rm',
        commands: [{ name: 'removeModule', args: { id: 'Spawner_1' } }],
      };
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.success).toBe(true);
      expect(result.config.modules).toHaveLength(1);
      expect(result.config.modules[0].id).toBe('Timer_1');
    });

    it('fails gracefully if module not found', () => {
      const result = RecipeExecutor.execute(
        { id: 'rm', commands: [{ name: 'removeModule', args: { id: 'nonexistent' } }] },
        makeEmptyConfig(),
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  // ── setParam ──

  describe('setParam', () => {
    it('sets a parameter on an existing module', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'Spawner_1', type: 'Spawner', enabled: true, params: { speed: 1 } }];
      const seq: CommandSequence = {
        id: 'sp',
        commands: [{ name: 'setParam', args: { moduleId: 'Spawner_1', param: 'speed', value: 10 } }],
      };
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.success).toBe(true);
      expect(result.config.modules[0].params.speed).toBe(10);
      // original not mutated
      expect(config.modules[0].params.speed).toBe(1);
    });

    it('fails if target module not found', () => {
      const result = RecipeExecutor.execute(
        { id: 'sp', commands: [{ name: 'setParam', args: { moduleId: 'Ghost_1', param: 'x', value: 0 } }] },
        makeEmptyConfig(),
        {},
      );
      expect(result.success).toBe(false);
    });
  });

  // ── batchSetParams ──

  describe('batchSetParams', () => {
    it('sets multiple params at once', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'S1', type: 'Spawner', enabled: true, params: { a: 1, b: 2 } }];
      const seq: CommandSequence = {
        id: 'bp',
        commands: [{ name: 'batchSetParams', args: { moduleId: 'S1', params: { a: 10, b: 20, c: 30 } } }],
      };
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.config.modules[0].params).toEqual({ a: 10, b: 20, c: 30 });
    });
  });

  // ── addAsset ──

  describe('addAsset', () => {
    it('adds an asset entry', () => {
      const seq: CommandSequence = {
        id: 'aa',
        commands: [{ name: 'addAsset', args: { assetId: 'bg', type: 'background', src: 'bg.png' } }],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.success).toBe(true);
      expect(result.config.assets.bg).toEqual({ type: 'background', src: 'bg.png' });
    });
  });

  // ── setMeta ──

  describe('setMeta', () => {
    it('updates meta fields', () => {
      const seq: CommandSequence = {
        id: 'sm',
        commands: [{ name: 'setMeta', args: { name: 'Cool Game', theme: 'space' } }],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.config.meta.name).toBe('Cool Game');
      expect(result.config.meta.theme).toBe('space');
    });
  });

  // ── configureCanvas ──

  describe('configureCanvas', () => {
    it('updates canvas dimensions', () => {
      const seq: CommandSequence = {
        id: 'cc',
        commands: [{ name: 'configureCanvas', args: { width: 720, height: 1280, background: '#000' } }],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.config.canvas.width).toBe(720);
      expect(result.config.canvas.height).toBe(1280);
      expect(result.config.canvas.background).toBe('#000');
    });
  });

  // ── enableModule / disableModule ──

  describe('enableModule / disableModule', () => {
    it('enables a disabled module', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'T1', type: 'Timer', enabled: false, params: {} }];
      const result = RecipeExecutor.execute(
        { id: 'en', commands: [{ name: 'enableModule', args: { id: 'T1' } }] },
        config,
        {},
      );
      expect(result.config.modules[0].enabled).toBe(true);
    });

    it('disables an enabled module', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'T1', type: 'Timer', enabled: true, params: {} }];
      const result = RecipeExecutor.execute(
        { id: 'dis', commands: [{ name: 'disableModule', args: { id: 'T1' } }] },
        config,
        {},
      );
      expect(result.config.modules[0].enabled).toBe(false);
    });
  });

  // ── duplicateModule ──

  describe('duplicateModule', () => {
    it('clones a module with new id', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'S1', type: 'Spawner', enabled: true, params: { speed: 5 } }];
      const result = RecipeExecutor.execute(
        { id: 'dup', commands: [{ name: 'duplicateModule', args: { sourceId: 'S1', newId: 'S2' } }] },
        config,
        {},
      );
      expect(result.config.modules).toHaveLength(2);
      expect(result.config.modules[1].id).toBe('S2');
      expect(result.config.modules[1].type).toBe('Spawner');
      expect(result.config.modules[1].params.speed).toBe(5);
      // source unchanged
      expect(result.config.modules[0].id).toBe('S1');
    });

    it('fails if source not found', () => {
      const result = RecipeExecutor.execute(
        { id: 'dup', commands: [{ name: 'duplicateModule', args: { sourceId: 'X', newId: 'Y' } }] },
        makeEmptyConfig(),
        {},
      );
      expect(result.success).toBe(false);
    });
  });

  // ── Variable Substitution ──

  describe('variable substitution', () => {
    it('substitutes $var references in args', () => {
      const seq: CommandSequence = {
        id: 'vars',
        commands: [
          { name: 'addModule', args: { type: 'Spawner', id: '$spawnerId', params: { speed: '$speed' } } },
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {
        spawnerId: 'Spawner_42',
        speed: 7,
      });
      expect(result.success).toBe(true);
      expect(result.config.modules[0].id).toBe('Spawner_42');
      expect(result.config.modules[0].params.speed).toBe(7);
    });

    it('leaves non-$var strings untouched', () => {
      const seq: CommandSequence = {
        id: 'no-sub',
        commands: [
          { name: 'addModule', args: { type: 'Timer', id: 'Timer_1', params: {} } },
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.config.modules[0].id).toBe('Timer_1');
    });
  });

  // ── Conditional (when) ──

  describe('conditional execution (when)', () => {
    it('skips command when condition is false', () => {
      const seq: CommandSequence = {
        id: 'cond',
        commands: [
          { name: 'addModule', args: { type: 'Spawner', id: 'S1', params: {} } },
          { name: 'addModule', args: { type: 'Timer', id: 'T1', params: {} }, when: 'hasTimer' },
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), { hasTimer: false });
      expect(result.config.modules).toHaveLength(1);
      expect(result.config.modules[0].type).toBe('Spawner');
    });

    it('executes command when condition is true', () => {
      const seq: CommandSequence = {
        id: 'cond2',
        commands: [
          { name: 'addModule', args: { type: 'Timer', id: 'T1', params: {} }, when: 'hasTimer' },
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), { hasTimer: true });
      expect(result.config.modules).toHaveLength(1);
    });

    it('supports negation with ! prefix', () => {
      const seq: CommandSequence = {
        id: 'neg',
        commands: [
          { name: 'addModule', args: { type: 'Timer', id: 'T1', params: {} }, when: '!skipTimer' },
        ],
      };
      // skipTimer=true → !skipTimer=false → skipped
      const r1 = RecipeExecutor.execute(seq, makeEmptyConfig(), { skipTimer: true });
      expect(r1.config.modules).toHaveLength(0);
      // skipTimer=false → !skipTimer=true → executed
      const r2 = RecipeExecutor.execute(seq, makeEmptyConfig(), { skipTimer: false });
      expect(r2.config.modules).toHaveLength(1);
    });
  });

  // ── Duplicate module ID guard ──

  describe('duplicate module ID', () => {
    it('fails when adding a module with existing id', () => {
      const config = makeEmptyConfig();
      config.modules = [{ id: 'S1', type: 'Spawner', enabled: true, params: {} }];
      const seq: CommandSequence = {
        id: 'dup-id',
        commands: [{ name: 'addModule', args: { type: 'Timer', id: 'S1', params: {} } }],
      };
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already exists/i);
    });
  });

  // ── Rollback ──

  describe('rollback on failure', () => {
    it('rolls back added modules when a later command fails', () => {
      const seq: CommandSequence = {
        id: 'rollback',
        commands: [
          { name: 'addModule', args: { type: 'Spawner', id: 'S1', params: {} } },
          { name: 'addModule', args: { type: 'Timer', id: 'T1', params: {} } },
          // This will fail — trying to set param on non-existent module
          { name: 'setParam', args: { moduleId: 'Ghost', param: 'x', value: 0 } },
        ],
      };
      const config = makeEmptyConfig();
      const result = RecipeExecutor.execute(seq, config, {});
      expect(result.success).toBe(false);
      // Rolled back — the returned config should NOT contain the added modules
      expect(result.config.modules).toHaveLength(0);
    });
  });

  // ── Validation gate ──

  describe('validation before execution', () => {
    it('rejects invalid commands without executing', () => {
      const seq: CommandSequence = {
        id: 'invalid',
        commands: [
          { name: 'addModule', args: {} }, // missing type and id
        ],
      };
      const result = RecipeExecutor.execute(seq, makeEmptyConfig(), {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/validation/i);
    });
  });
});
