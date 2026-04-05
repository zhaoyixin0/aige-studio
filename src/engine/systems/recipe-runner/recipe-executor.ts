// src/engine/systems/recipe-runner/recipe-executor.ts
// Command interpreter with variable substitution, conditional execution, and rollback.

import type { GameConfig, ModuleConfig, AssetEntry } from '../../core/types';
import type { CommandSequence, CommandName } from './types';
import { validateSequence } from './validators';

export interface ExecutorResult {
  readonly success: boolean;
  readonly config: GameConfig;
  readonly created: readonly string[];
  readonly error?: string;
}

// ── Deep clone ──

function cloneConfig(config: GameConfig): GameConfig {
  return structuredClone(config);
}

// ── Variable Substitution ──

function substituteValue(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const key = value.slice(1);
    return key in vars ? vars[key] : value;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteValue(v, vars);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteValue(v, vars));
  }
  return value;
}

function substituteArgs(
  args: Record<string, unknown>,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  return substituteValue(args, vars) as Record<string, unknown>;
}

// ── Condition Evaluation ──
// `when` is treated as a variable key lookup: truthy = execute, falsy = skip.
// Supports `!varName` for negation. Does NOT evaluate complex expressions.

function evalCondition(when: string, vars: Record<string, unknown>): boolean {
  if (when.startsWith('!')) {
    const key = when.slice(1);
    return !vars[key];
  }
  return Boolean(vars[when]);
}

// ── Command Handlers ──

type MutableState = {
  config: GameConfig;
  created: string[];
};

function findModule(state: MutableState, id: string): ModuleConfig | undefined {
  return state.config.modules.find((m) => m.id === id);
}

function findModuleIndex(state: MutableState, id: string): number {
  return state.config.modules.findIndex((m) => m.id === id);
}

type CommandHandler = (args: Record<string, unknown>, state: MutableState) => void;

const HANDLERS: Record<CommandName, CommandHandler> = {
  addModule(args, state) {
    const id = args.id as string;
    if (state.config.modules.some((m) => m.id === id)) {
      throw new Error(`Module id "${id}" already exists`);
    }
    const moduleConfig: ModuleConfig = {
      id,
      type: args.type as string,
      enabled: true,
      params: (args.params as Record<string, unknown>) ?? {},
    };
    state.config.modules = [...state.config.modules, moduleConfig];
    state.created.push(id);
  },

  removeModule(args, state) {
    const id = args.id as string;
    const idx = findModuleIndex(state, id);
    if (idx < 0) throw new Error(`Module "${id}" not found`);
    state.config.modules = state.config.modules.filter((_, i) => i !== idx);
  },

  setParam(args, state) {
    const moduleId = args.moduleId as string;
    const param = args.param as string;
    const value = args.value;
    const idx = findModuleIndex(state, moduleId);
    if (idx < 0) throw new Error(`Module "${moduleId}" not found`);
    state.config.modules = state.config.modules.map((m, i) =>
      i === idx ? { ...m, params: { ...m.params, [param]: value } } : m,
    );
  },

  batchSetParams(args, state) {
    const moduleId = args.moduleId as string;
    const params = args.params as Record<string, unknown>;
    const idx = findModuleIndex(state, moduleId);
    if (idx < 0) throw new Error(`Module "${moduleId}" not found`);
    state.config.modules = state.config.modules.map((m, i) =>
      i === idx ? { ...m, params: { ...m.params, ...params } } : m,
    );
  },

  addAsset(args, state) {
    const assetId = args.assetId as string;
    const entry: AssetEntry = {
      type: args.type as AssetEntry['type'],
      src: args.src as string,
    };
    state.config.assets = { ...state.config.assets, [assetId]: entry };
  },

  setMeta(args, state) {
    const { ...fields } = args;
    state.config.meta = { ...state.config.meta, ...fields };
  },

  configureCanvas(args, state) {
    state.config.canvas = {
      ...state.config.canvas,
      width: args.width as number,
      height: args.height as number,
      ...(args.background !== undefined ? { background: args.background as string } : {}),
    };
  },

  enableModule(args, state) {
    const id = args.id as string;
    const idx = findModuleIndex(state, id);
    if (idx < 0) throw new Error(`Module "${id}" not found`);
    state.config.modules = state.config.modules.map((m, i) =>
      i === idx ? { ...m, enabled: true } : m,
    );
  },

  disableModule(args, state) {
    const id = args.id as string;
    const idx = findModuleIndex(state, id);
    if (idx < 0) throw new Error(`Module "${id}" not found`);
    state.config.modules = state.config.modules.map((m, i) =>
      i === idx ? { ...m, enabled: false } : m,
    );
  },

  duplicateModule(args, state) {
    const sourceId = args.sourceId as string;
    const newId = args.newId as string;
    const source = findModule(state, sourceId);
    if (!source) throw new Error(`Source module "${sourceId}" not found`);
    const clone: ModuleConfig = {
      ...source,
      id: newId,
      params: structuredClone(source.params),
    };
    state.config.modules = [...state.config.modules, clone];
    state.created.push(newId);
  },
};

// ── Executor ──

export const RecipeExecutor = {
  execute(
    sequence: CommandSequence,
    config: GameConfig,
    variables: Record<string, unknown>,
  ): ExecutorResult {
    // 1. Validate
    const validation = validateSequence(sequence);
    if (!validation.valid) {
      return {
        success: false,
        config,
        created: [],
        error: `Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
      };
    }

    // 2. Clone config (immutability)
    const state: MutableState = {
      config: cloneConfig(config),
      created: [],
    };

    // 3. Execute commands
    for (const cmd of sequence.commands) {
      // Conditional skip
      if (cmd.when && !evalCondition(cmd.when, variables)) {
        continue;
      }

      // Substitute variables
      const resolvedArgs = substituteArgs(cmd.args, variables);

      const handler = HANDLERS[cmd.name];
      if (!handler) {
        return rollbackAndFail(state, config, `Unknown command: ${cmd.name}`);
      }

      try {
        handler(resolvedArgs, state);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return rollbackAndFail(state, config, msg);
      }
    }

    return {
      success: true,
      config: state.config,
      created: state.created,
    };
  },
};

function rollbackAndFail(
  _state: MutableState,
  originalConfig: GameConfig,
  error: string,
): ExecutorResult {
  // Rollback: remove all created modules by restoring original config
  return {
    success: false,
    config: cloneConfig(originalConfig),
    created: [],
    error,
  };
}
