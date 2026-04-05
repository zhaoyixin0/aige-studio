// src/engine/systems/recipe-runner/types.ts
// M4 Recipe Runner — declarative GameConfig transformations.

// ── Parameter Specification ──

export type ParamType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'vec2'
  | 'color'
  | 'assetId';

export interface ParamSpec {
  readonly name: string;
  readonly type: ParamType;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly description?: string;
}

// ── Commands ──

export type CommandName =
  | 'addModule'
  | 'removeModule'
  | 'setParam'
  | 'batchSetParams'
  | 'addAsset'
  | 'setMeta'
  | 'configureCanvas'
  | 'enableModule'
  | 'disableModule'
  | 'duplicateModule';

export interface Command {
  readonly name: CommandName;
  readonly args: Record<string, unknown>;
  readonly comment?: string;
  readonly when?: string; // variable key lookup — truthy = execute, falsy = skip; prefix with ! for negation
}

// ── Sequences & Templates ──

export interface CommandSequence {
  readonly id: string;
  readonly commands: readonly Command[];
}

export interface PresetTemplate {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly gameType?: string;
  readonly tags: readonly string[];
  readonly params: readonly ParamSpec[];
  readonly sequence: CommandSequence;
  readonly requiredModules?: readonly string[];
}

// ── Validation ──

export interface ValidationError {
  readonly command: CommandName;
  readonly field: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}
