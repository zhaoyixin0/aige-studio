// src/engine/core/config-validator.ts
//
// Pre-load validation layer for GameConfig.
// Catches parameter errors, event chain breaks, and module conflicts
// BEFORE the engine loads — preventing "runs but broken" games.

import type { GameConfig, ModuleConfig } from './types';

// ── Result types ───────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  readonly severity: IssueSeverity;
  readonly category:
    | 'unknown-module'
    | 'missing-dependency'
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

// ── Known module types (derived from module-setup.ts registry) ─

export const KNOWN_MODULE_TYPES: ReadonlySet<string> = new Set([
  // Input
  'FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput',
  // Mechanic
  'Spawner', 'Collision', 'Scorer', 'Timer', 'Lives', 'DifficultyRamp',
  'Randomizer', 'QuizEngine',
  // P1 extended
  'ExpressionDetector', 'ComboSystem', 'Jump', 'PowerUp',
  // P2 extended
  'BeatMap', 'GestureMatch', 'MatchEngine', 'Runner',
  // P3 extended
  'PlaneDetection', 'BranchStateMachine', 'DressUpEngine',
  // Platformer
  'Gravity', 'PlayerMovement', 'StaticPlatform', 'MovingPlatform',
  'CrumblingPlatform', 'OneWayPlatform', 'CoyoteTime', 'Dash',
  'WallDetect', 'Knockback', 'IFrames', 'Collectible', 'Hazard',
  'Checkpoint', 'Inventory', 'Health', 'Shield',
  // RPG (Batch 3)
  'EquipmentSlot', 'EnemyDrop', 'LevelUp', 'StatusEffect', 'SkillTree', 'DialogueSystem',
  // Shooter (Batch 2)
  'Projectile', 'BulletPattern', 'Aim', 'EnemyAI', 'WaveSpawner',
  // Feedback
  'GameFlow', 'ParticleVFX', 'SoundFX', 'UIOverlay', 'ResultScreen', 'CameraFollow',
]);

// Module dependency declarations (mirrors each module's getDependencies())
const MODULE_DEPENDENCIES: Record<string, { requires: string[]; optional: string[] }> = {
  Scorer: { requires: ['Collision'], optional: ['ComboSystem'] },
  Lives: { requires: [], optional: [] },
  Timer: { requires: [], optional: [] },
  DifficultyRamp: { requires: [], optional: [] },
  Jump: { requires: [], optional: ['Gravity'] },
  CoyoteTime: { requires: ['Jump'], optional: [] },
  Dash: { requires: ['PlayerMovement'], optional: [] },
  Knockback: { requires: ['PlayerMovement'], optional: [] },
  Projectile: { requires: ['Collision'], optional: ['Aim'] },
  Aim: { requires: [], optional: ['EnemyAI'] },
  WaveSpawner: { requires: [], optional: ['EnemyAI'] },
  Health: { requires: [], optional: [] },
  Shield: { requires: [], optional: ['Health'] },
  Collectible: { requires: ['Collision'], optional: [] },
  Hazard: { requires: ['Collision'], optional: [] },
  EnemyDrop: { requires: [], optional: ['EnemyAI'] },
  LevelUp: { requires: [], optional: [] },
  SkillTree: { requires: [], optional: ['LevelUp'] },
  Inventory: { requires: [], optional: [] },
  IFrames: { requires: [], optional: [] },
};

// Events that scorer.hitEvent can validly reference
const SCORER_VALID_HIT_EVENTS: ReadonlySet<string> = new Set([
  'collision:hit', 'collision:damage',
  'beat:hit', 'quiz:correct', 'expression:detected',
  'gesture:match', 'match:found', 'collectible:pickup',
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

function checkDependencies(modules: readonly ModuleConfig[]): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const presentTypes = new Set(modules.map((m) => m.type));

  for (const m of modules) {
    const deps = MODULE_DEPENDENCIES[m.type];
    if (!deps) continue;

    for (const req of deps.requires) {
      // Scorer's dependency on Collision is conditional:
      // Only required when hitEvent is collision-based (default or explicit)
      if (m.type === 'Scorer' && req === 'Collision') {
        const hitEvent = (m.params.hitEvent as string | undefined);
        // If hitEvent is explicitly set to a non-collision event, Collision is not required
        if (hitEvent && !hitEvent.startsWith('collision:')) {
          continue;
        }
      }

      if (!presentTypes.has(req)) {
        errors.push({
          severity: 'error',
          category: 'missing-dependency',
          moduleId: m.id,
          message: `Module "${m.type}" requires "${req}" but it is not present. Add a ${req} module.`,
        });
      }
    }
  }
  return errors;
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

function checkEventChains(modules: readonly ModuleConfig[]): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const presentTypes = new Set(modules.map((m) => m.type));

  for (const m of modules) {
    if (m.type !== 'Scorer') continue;

    const hitEvent = (m.params.hitEvent as string) ?? 'collision:hit';

    // Check if the hitEvent is a known valid event
    if (!SCORER_VALID_HIT_EVENTS.has(hitEvent)) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Scorer.hitEvent "${hitEvent}" is not a known scorable event. ` +
          `Valid events: ${[...SCORER_VALID_HIT_EVENTS].join(', ')}.`,
      });
      continue;
    }

    // Check that the event source module exists
    if (hitEvent.startsWith('collision:') && !presentTypes.has('Collision')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Scorer listens to "${hitEvent}" but no Collision module is present to emit it.`,
      });
    }
    if (hitEvent === 'beat:hit' && !presentTypes.has('BeatMap')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "beat:hit" but no BeatMap module is present.',
      });
    }
    if (hitEvent === 'quiz:correct' && !presentTypes.has('QuizEngine')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "quiz:correct" but no QuizEngine module is present.',
      });
    }
    if (hitEvent === 'expression:detected' && !presentTypes.has('ExpressionDetector')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "expression:detected" but no ExpressionDetector module is present.',
      });
    }
    if (hitEvent === 'gesture:match' && !presentTypes.has('GestureMatch')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "gesture:match" but no GestureMatch module is present.',
      });
    }
    if (hitEvent === 'match:found' && !presentTypes.has('MatchEngine')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "match:found" but no MatchEngine module is present.',
      });
    }
    if (hitEvent === 'collectible:pickup' && !presentTypes.has('Collectible')) {
      errors.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: 'Scorer listens to "collectible:pickup" but no Collectible module is present.',
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
 */
export function validateConfig(
  config: GameConfig,
  knownModules: ReadonlySet<string> = KNOWN_MODULE_TYPES,
): ValidationReport {
  const enabledModules = getEnabledModules(config);

  // Run all validation passes
  const unknownErrors = checkUnknownModules(enabledModules, knownModules);
  const depErrors = checkDependencies(enabledModules);
  const rulesErrors = checkEmptyCollisionRules(enabledModules);
  const chainErrors = checkEventChains(enabledModules);
  const conflictWarnings = checkModuleConflicts(enabledModules);
  const inputWarnings = checkMissingInput(enabledModules);
  const { warnings: paramWarnings, fixes } = checkAndFixParams(enabledModules);

  const errors = [...unknownErrors, ...depErrors, ...rulesErrors, ...chainErrors];
  const warnings = [...conflictWarnings, ...inputWarnings, ...paramWarnings];

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
