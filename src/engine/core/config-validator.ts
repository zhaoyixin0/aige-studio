// src/engine/core/config-validator.ts
//
// Pre-load validation layer for GameConfig.
// Catches parameter errors, event chain breaks, and module conflicts
// BEFORE the engine loads — preventing "runs but broken" games.

import type { GameConfig, ModuleConfig } from './types';
import type { ContractRegistry } from './contract-registry';

// ── Result types ───────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  readonly severity: IssueSeverity;
  readonly category:
    | 'unknown-module'
    | 'invalid-param'
    | 'empty-rules'
    | 'event-chain-break'
    | 'module-conflict'
    | 'missing-input';
  readonly moduleId: string;
  readonly message: string;
}

export interface AutoFix {
  readonly moduleId: string;
  readonly param: string;
  readonly from: unknown;
  readonly to: unknown;
  readonly reason: string;
}

export interface ValidationReport {
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  readonly fixes: readonly AutoFix[];
  readonly isPlayable: boolean;
}

// Universal events handled by BaseModule.init() — always available, never flagged
const UNIVERSAL_EVENTS: ReadonlySet<string> = new Set([
  'gameflow:resume', 'gameflow:pause',
]);

// Input module types
const INPUT_MODULE_TYPES: ReadonlySet<string> = new Set([
  'FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput',
]);

// Singleton module types (only one instance allowed)
const SINGLETON_MODULE_TYPES: ReadonlySet<string> = new Set([
  'PlayerMovement', 'Collision', 'Scorer', 'Timer', 'Lives', 'GameFlow',
  'Runner', 'Gravity', 'Health',
  ...INPUT_MODULE_TYPES,
]);

// ── Validation passes ──────────────────────────────────────────

function getEnabledModules(config: GameConfig): readonly ModuleConfig[] {
  return config.modules.filter((m) => m.enabled !== false);
}

function checkUnknownModules(
  modules: readonly ModuleConfig[],
  knownModules: ReadonlySet<string>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  for (const m of modules) {
    if (!knownModules.has(m.type)) {
      errors.push({
        severity: 'error',
        category: 'unknown-module',
        moduleId: m.id,
        message: `Unknown module type "${m.type}". Check spelling or register it in module-setup.ts.`,
      });
    }
  }
  return errors;
}

function buildEmitsPool(
  modules: readonly ModuleConfig[],
  contracts: ContractRegistry,
): ReadonlySet<string> {
  const pool = new Set<string>();
  for (const m of modules) {
    for (const event of contracts.getEmits(m.type)) {
      pool.add(event);
    }
  }
  return pool;
}

function checkEventFulfillment(
  modules: readonly ModuleConfig[],
  contracts: ContractRegistry,
  emitsPool: ReadonlySet<string>,
): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  for (const m of modules) {
    for (const event of contracts.getConsumes(m.type)) {
      if (UNIVERSAL_EVENTS.has(event)) continue;
      if (emitsPool.has(event)) continue;

      // Wildcard: consumes ending with :* matches any emitted event with that prefix
      if (event.endsWith(':*')) {
        const prefix = event.slice(0, -1);
        let matched = false;
        for (const e of emitsPool) {
          if (e.startsWith(prefix)) { matched = true; break; }
        }
        if (matched) continue;
      }

      warnings.push({
        severity: 'warning',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Module "${m.type}" consumes "${event}" but no enabled module emits it.`,
      });
    }
  }
  return warnings;
}

function checkEmptyCollisionRules(modules: readonly ModuleConfig[]): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  for (const m of modules) {
    if (m.type !== 'Collision') continue;

    const rules = m.params.rules;
    if (!Array.isArray(rules) || rules.length === 0) {
      errors.push({
        severity: 'error',
        category: 'empty-rules',
        moduleId: m.id,
        message: 'Collision module has no rules. At least one collision rule is required.',
      });
    }
  }
  return errors;
}

function checkEventChains(
  modules: readonly ModuleConfig[],
  emitsPool: ReadonlySet<string>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  for (const m of modules) {
    if (m.type !== 'Scorer') continue;

    const hitEvent = (m.params.hitEvent as string) ?? 'collision:hit';

    if (!emitsPool.has(hitEvent)) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Scorer.hitEvent "${hitEvent}" is not emitted by any enabled module. ` +
          `Ensure a module that emits "${hitEvent}" is present.`,
      });
    }
  }
  return errors;
}

function checkModuleConflicts(modules: readonly ModuleConfig[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const typeCounts = new Map<string, string[]>();

  for (const m of modules) {
    const ids = typeCounts.get(m.type) ?? [];
    ids.push(m.id);
    typeCounts.set(m.type, ids);
  }

  for (const [type, ids] of typeCounts) {
    if (ids.length > 1 && SINGLETON_MODULE_TYPES.has(type)) {
      issues.push({
        severity: 'warning',
        category: 'module-conflict',
        moduleId: ids[1],
        message: `Duplicate "${type}" module. Only one instance of ${type} should exist. ` +
          `IDs: ${ids.join(', ')}.`,
      });
    }
  }
  return issues;
}

function checkMissingInput(modules: readonly ModuleConfig[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const presentTypes = new Set(modules.map((m) => m.type));

  const hasPlayerMovement = presentTypes.has('PlayerMovement');
  const hasAnyInput = [...INPUT_MODULE_TYPES].some((t) => presentTypes.has(t));

  if (hasPlayerMovement && !hasAnyInput) {
    const pmModule = modules.find((m) => m.type === 'PlayerMovement')!;
    issues.push({
      severity: 'warning',
      category: 'missing-input',
      moduleId: pmModule.id,
      message: 'PlayerMovement exists but no input module (TouchInput, FaceInput, etc.) is present. ' +
        'The player will not be controllable.',
    });
  }
  return issues;
}

function checkAndFixParams(modules: readonly ModuleConfig[]): {
  warnings: ValidationIssue[];
  fixes: AutoFix[];
} {
  const warnings: ValidationIssue[] = [];
  const fixes: AutoFix[] = [];

  for (const m of modules) {
    // Spawner speed validation (read-only — only records fixes, never mutates)
    if (m.type === 'Spawner') {
      const speed = m.params.speed;
      if (speed && typeof speed === 'object' && 'min' in speed && 'max' in speed) {
        const sMin = speed.min as number;
        const sMax = speed.max as number;

        if (typeof sMin === 'number' && sMin < 0) {
          fixes.push({ moduleId: m.id, param: 'speed.min', from: sMin, to: 0, reason: 'Speed cannot be negative' });
          warnings.push({ severity: 'warning', category: 'invalid-param', moduleId: m.id, message: `Spawner speed.min was ${sMin}, clamped to 0.` });
        }
        if (typeof sMax === 'number' && sMax < 0) {
          fixes.push({ moduleId: m.id, param: 'speed.max', from: sMax, to: 0, reason: 'Speed cannot be negative' });
          warnings.push({ severity: 'warning', category: 'invalid-param', moduleId: m.id, message: `Spawner speed.max was ${sMax}, clamped to 0.` });
        }
        // Check inverted range (use clamped values for check)
        const effectiveMin = Math.max(sMin, 0);
        const effectiveMax = Math.max(sMax, 0);
        if (effectiveMin > effectiveMax) {
          fixes.push({ moduleId: m.id, param: 'speed.min', from: effectiveMin, to: effectiveMax, reason: 'speed.min > speed.max, swapped' });
          warnings.push({ severity: 'warning', category: 'invalid-param', moduleId: m.id, message: `Spawner speed.min (${effectiveMin}) > speed.max (${effectiveMax}), swapped.` });
        }
      }
    }

    // Timer duration validation (read-only)
    if (m.type === 'Timer') {
      const duration = m.params.duration;
      if (typeof duration === 'number' && duration <= 0) {
        const fixed = 30;
        fixes.push({ moduleId: m.id, param: 'duration', from: duration, to: fixed, reason: 'Timer duration must be positive' });
        warnings.push({ severity: 'warning', category: 'invalid-param', moduleId: m.id, message: `Timer duration was ${duration}, set to ${fixed}.` });
      }
    }

    // Lives count validation (read-only)
    if (m.type === 'Lives') {
      const count = m.params.count;
      if (typeof count === 'number' && count <= 0) {
        const fixed = 3;
        fixes.push({ moduleId: m.id, param: 'count', from: count, to: fixed, reason: 'Lives count must be at least 1' });
        warnings.push({ severity: 'warning', category: 'invalid-param', moduleId: m.id, message: `Lives count was ${count}, set to ${fixed}.` });
      }
    }
  }

  return { warnings, fixes };
}

// ── Main validator ─────────────────────────────────────────────

/**
 * Validate a GameConfig before loading into the engine.
 * Returns a report with errors (must fix), warnings (auto-fixed), and fixes applied.
 *
 * When a ContractRegistry is provided, validation uses module contracts for:
 * - Unknown module type detection (via getKnownTypes)
 * - Event fulfillment checks (consumes vs emits pool)
 * - Scorer hitEvent chain validation (hitEvent vs emits pool)
 */
export function validateConfig(
  config: GameConfig,
  contracts?: ContractRegistry,
): ValidationReport {
  const enabledModules = getEnabledModules(config);

  // Contract-based checks (require ContractRegistry)
  const emitsPool = contracts ? buildEmitsPool(enabledModules, contracts) : undefined;
  const unknownErrors = contracts
    ? checkUnknownModules(enabledModules, contracts.getKnownTypes())
    : [];
  const fulfillmentWarnings = contracts && emitsPool
    ? checkEventFulfillment(enabledModules, contracts, emitsPool)
    : [];
  const chainErrors = emitsPool
    ? checkEventChains(enabledModules, emitsPool)
    : [];

  // Non-contract checks (always run)
  const rulesErrors = checkEmptyCollisionRules(enabledModules);
  const conflictWarnings = checkModuleConflicts(enabledModules);
  const inputWarnings = checkMissingInput(enabledModules);
  const { warnings: paramWarnings, fixes } = checkAndFixParams(enabledModules);

  const errors = [...unknownErrors, ...rulesErrors, ...chainErrors];
  const warnings = [...fulfillmentWarnings, ...conflictWarnings, ...inputWarnings, ...paramWarnings];

  return {
    errors,
    warnings,
    fixes,
    isPlayable: errors.length === 0,
  };
}

/**
 * Apply recorded fixes to a GameConfig, returning a new config (immutable).
 * Only applies fixes from the report — does not re-validate.
 */
export function applyFixes(config: GameConfig, fixes: readonly AutoFix[]): GameConfig {
  if (fixes.length === 0) return config;

  const fixesByModule = new Map<string, AutoFix[]>();
  for (const fix of fixes) {
    const list = fixesByModule.get(fix.moduleId) ?? [];
    list.push(fix);
    fixesByModule.set(fix.moduleId, list);
  }

  return {
    ...config,
    modules: config.modules.map((m) => {
      const moduleFixes = fixesByModule.get(m.id);
      if (!moduleFixes) return m;

      let params = { ...m.params };
      for (const fix of moduleFixes) {
        if (fix.param.includes('.')) {
          // Nested param (e.g., 'speed.min')
          const [parent, child] = fix.param.split('.');
          params = {
            ...params,
            [parent]: { ...(params[parent] as Record<string, unknown>), [child]: fix.to },
          };
        } else {
          params = { ...params, [fix.param]: fix.to };
        }
      }
      return { ...m, params };
    }),
  };
}
