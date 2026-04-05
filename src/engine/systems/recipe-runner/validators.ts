// src/engine/systems/recipe-runner/validators.ts
// Per-command argument validation for Recipe Runner.

import type {
  Command,
  CommandName,
  CommandSequence,
  ParamSpec,
  ValidationError,
  ValidationResult,
} from './types';

// ── Helpers ──

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(command: CommandName, field: string, message: string): ValidationResult {
  return { valid: false, errors: [{ command, field, message }] };
}

function requireString(
  args: Record<string, unknown>,
  field: string,
  command: CommandName,
): ValidationError | null {
  if (typeof args[field] !== 'string' || (args[field] as string).length === 0) {
    return { command, field, message: `${field} is required and must be a non-empty string` };
  }
  return null;
}

// ── ParamSpec Validation ──

export function validateParamValue(spec: ParamSpec, value: unknown): ValidationResult {
  const cmd = 'setParam' as CommandName;

  switch (spec.type) {
    case 'number': {
      if (typeof value !== 'number') {
        return fail(cmd, spec.name, `Expected type number, got ${typeof value}`);
      }
      if (spec.min !== undefined && value < spec.min) {
        return fail(cmd, spec.name, `Value ${value} is below min ${spec.min}`);
      }
      if (spec.max !== undefined && value > spec.max) {
        return fail(cmd, spec.name, `Value ${value} is above max ${spec.max}`);
      }
      return ok();
    }
    case 'string':
    case 'color':
    case 'assetId': {
      if (typeof value !== 'string') {
        return fail(cmd, spec.name, `Expected type string, got ${typeof value}`);
      }
      return ok();
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return fail(cmd, spec.name, `Expected type boolean, got ${typeof value}`);
      }
      return ok();
    }
    case 'enum': {
      if (typeof value !== 'string' || !spec.enumValues || !spec.enumValues.includes(value)) {
        return fail(cmd, spec.name, `Value "${String(value)}" not in enum [${spec.enumValues?.join(', ')}]`);
      }
      return ok();
    }
    case 'vec2': {
      if (
        typeof value !== 'object' ||
        value === null ||
        typeof (value as Record<string, unknown>).x !== 'number' ||
        typeof (value as Record<string, unknown>).y !== 'number'
      ) {
        return fail(cmd, spec.name, 'vec2 requires { x: number, y: number }');
      }
      return ok();
    }
    default:
      return fail(cmd, spec.name, `Unknown param type: ${spec.type}`);
  }
}

// ── Command Validation ──

type CommandValidator = (args: Record<string, unknown>) => ValidationResult;

const COMMAND_VALIDATORS: Record<CommandName, CommandValidator> = {
  addModule(args) {
    const errors: ValidationError[] = [];
    const eType = requireString(args, 'type', 'addModule');
    if (eType) errors.push(eType);
    const eId = requireString(args, 'id', 'addModule');
    if (eId) errors.push(eId);
    return errors.length > 0 ? { valid: false, errors } : ok();
  },

  removeModule(args) {
    const e = requireString(args, 'id', 'removeModule');
    return e ? { valid: false, errors: [e] } : ok();
  },

  setParam(args) {
    const errors: ValidationError[] = [];
    const eModule = requireString(args, 'moduleId', 'setParam');
    if (eModule) errors.push(eModule);
    const eParam = requireString(args, 'param', 'setParam');
    if (eParam) errors.push(eParam);
    if (!('value' in args)) {
      errors.push({ command: 'setParam', field: 'value', message: 'value is required' });
    }
    return errors.length > 0 ? { valid: false, errors } : ok();
  },

  batchSetParams(args) {
    const errors: ValidationError[] = [];
    const eModule = requireString(args, 'moduleId', 'batchSetParams');
    if (eModule) errors.push(eModule);
    if (typeof args.params !== 'object' || args.params === null || Array.isArray(args.params)) {
      errors.push({ command: 'batchSetParams', field: 'params', message: 'params must be a plain object' });
    }
    return errors.length > 0 ? { valid: false, errors } : ok();
  },

  addAsset(args) {
    const errors: ValidationError[] = [];
    const eId = requireString(args, 'assetId', 'addAsset');
    if (eId) errors.push(eId);
    const eType = requireString(args, 'type', 'addAsset');
    if (eType) errors.push(eType);
    const eSrc = requireString(args, 'src', 'addAsset');
    if (eSrc) errors.push(eSrc);
    return errors.length > 0 ? { valid: false, errors } : ok();
  },

  setMeta(args) {
    if (Object.keys(args).length === 0) {
      return fail('setMeta', 'args', 'setMeta requires at least one field');
    }
    return ok();
  },

  configureCanvas(args) {
    const errors: ValidationError[] = [];
    if (typeof args.width !== 'number') {
      errors.push({ command: 'configureCanvas', field: 'width', message: 'width must be a number' });
    }
    if (typeof args.height !== 'number') {
      errors.push({ command: 'configureCanvas', field: 'height', message: 'height must be a number' });
    }
    return errors.length > 0 ? { valid: false, errors } : ok();
  },

  enableModule(args) {
    const e = requireString(args, 'id', 'enableModule');
    return e ? { valid: false, errors: [e] } : ok();
  },

  disableModule(args) {
    const e = requireString(args, 'id', 'disableModule');
    return e ? { valid: false, errors: [e] } : ok();
  },

  duplicateModule(args) {
    const errors: ValidationError[] = [];
    const eSrc = requireString(args, 'sourceId', 'duplicateModule');
    if (eSrc) errors.push(eSrc);
    const eNew = requireString(args, 'newId', 'duplicateModule');
    if (eNew) errors.push(eNew);
    return errors.length > 0 ? { valid: false, errors } : ok();
  },
};

export function validateCommand(cmd: Command): ValidationResult {
  const validator = COMMAND_VALIDATORS[cmd.name];
  if (!validator) {
    return fail(cmd.name, 'name', `Unknown command: ${cmd.name}`);
  }
  return validator(cmd.args);
}

// ── Sequence Validation ──

export function validateSequence(seq: CommandSequence): ValidationResult {
  const allErrors: ValidationError[] = [];
  for (const cmd of seq.commands) {
    const r = validateCommand(cmd);
    if (!r.valid) {
      allErrors.push(...r.errors);
    }
  }
  return allErrors.length > 0 ? { valid: false, errors: allErrors } : ok();
}
