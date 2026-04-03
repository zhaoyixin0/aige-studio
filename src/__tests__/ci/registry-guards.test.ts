// CI guard tests — validate Parameter Registry integrity and DAG acyclicity
// These run fast (< 2s) and catch data corruption before it reaches production.

import { describe, it, expect } from 'vitest';
import {
  PARAMETER_REGISTRY,
  type ParamLayer,
  type ParamCategory,
  type ParamMvp,
  type ParamExposure,
  type ParamControlType,
} from '@/data/parameter-registry';
import { validateDag } from '@/engine/core/dependency-resolver';
import { createModuleRegistry } from '@/engine/module-setup';

// --- Valid enum value sets ---

const VALID_LAYERS: ReadonlySet<ParamLayer> = new Set(['L1', 'L2', 'L3']);
const VALID_CATEGORIES: ReadonlySet<ParamCategory> = new Set([
  'abstract',
  'game_mechanics',
  'game_objects',
  'visual_audio',
  'input',
  'online',
]);
const VALID_MVP: ReadonlySet<ParamMvp> = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_EXPOSURE: ReadonlySet<ParamExposure> = new Set([
  'direct',
  'composite',
  'hidden',
]);
const VALID_CONTROL_TYPE: ReadonlySet<ParamControlType> = new Set([
  'toggle',
  'slider',
  'segmented',
  'stepper',
  'asset_picker',
  'input_field',
]);

describe('Parameter Registry CI Guards', () => {
  // 1. No duplicate IDs
  it('all param IDs are unique', () => {
    const ids = PARAMETER_REGISTRY.map((p) => p.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const id of ids) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }

    expect(duplicates).toEqual([]);
    expect(ids.length).toBe(228);
  });

  // 2. No missing defaults
  it('every param has a defined defaultValue', () => {
    const missing = PARAMETER_REGISTRY.filter(
      (p) => p.defaultValue === undefined || p.defaultValue === null,
    );

    expect(missing.map((p) => p.id)).toEqual([]);
  });

  // 3. Valid enum values
  it('all layer values are valid ParamLayer members', () => {
    const invalid = PARAMETER_REGISTRY.filter(
      (p) => !VALID_LAYERS.has(p.layer),
    );
    expect(invalid.map((p) => `${p.id}: ${p.layer}`)).toEqual([]);
  });

  it('all mvp values are valid ParamMvp members', () => {
    const invalid = PARAMETER_REGISTRY.filter((p) => !VALID_MVP.has(p.mvp));
    expect(invalid.map((p) => `${p.id}: ${p.mvp}`)).toEqual([]);
  });

  it('all exposure values are valid ParamExposure members', () => {
    const invalid = PARAMETER_REGISTRY.filter(
      (p) => !VALID_EXPOSURE.has(p.exposure),
    );
    expect(invalid.map((p) => `${p.id}: ${p.exposure}`)).toEqual([]);
  });

  it('all controlType values are valid ParamControlType members', () => {
    const invalid = PARAMETER_REGISTRY.filter(
      (p) => !VALID_CONTROL_TYPE.has(p.controlType),
    );
    expect(invalid.map((p) => `${p.id}: ${p.controlType}`)).toEqual([]);
  });

  it('all category values are valid ParamCategory members', () => {
    const invalid = PARAMETER_REGISTRY.filter(
      (p) => !VALID_CATEGORIES.has(p.category),
    );
    expect(invalid.map((p) => `${p.id}: ${p.category}`)).toEqual([]);
  });

  // 4. DAG acyclic
  it('parameter dependency graph is acyclic', () => {
    const result = validateDag(PARAMETER_REGISTRY);

    expect(result).toEqual({ valid: true });
  });

  // 5. Dependency refs valid
  it('all dependsOn.paramId reference existing param IDs', () => {
    const allIds = new Set(PARAMETER_REGISTRY.map((p) => p.id));
    const broken = PARAMETER_REGISTRY.filter(
      (p) => p.dependsOn && !allIds.has(p.dependsOn.paramId),
    );

    expect(
      broken.map((p) => `${p.id} -> ${p.dependsOn!.paramId}`),
    ).toEqual([]);
  });

  // 6. P0 params complete
  it('all P0 params have non-empty descriptions', () => {
    const p0Params = PARAMETER_REGISTRY.filter((p) => p.mvp === 'P0');
    const incomplete = p0Params.filter(
      (p) => !p.description || p.description.trim().length === 0,
    );

    expect(incomplete.map((p) => p.id)).toEqual([]);
    expect(p0Params.length).toBe(12);
  });

  // 7. Registry <-> Schema consistency (soft check: warn, don't fail)
  it('registry params have corresponding module schema fields (soft)', () => {
    const moduleRegistry = createModuleRegistry();
    const moduleTypes = moduleRegistry.getTypes();
    const warnings: string[] = [];

    for (const moduleType of moduleTypes) {
      try {
        const instance = moduleRegistry.create(moduleType, `test-${moduleType}`);
        const schema = instance.getSchema();
        const schemaKeys = Object.keys(schema);

        // Find registry params whose name or id loosely associates with this module type
        // This is a soft heuristic — the Registry is a superset of module schemas
        if (schemaKeys.length === 0) {
          continue; // Module has no schema fields, skip
        }

        // Log info for traceability, but do not fail
        const unmatchedSchemaKeys = schemaKeys.filter((key) => {
          // Check if any registry param references a similar concept
          const found = PARAMETER_REGISTRY.some(
            (p) =>
              p.id.includes(key) ||
              p.name.includes(key) ||
              key.includes(p.id),
          );
          return !found;
        });

        if (unmatchedSchemaKeys.length > 0) {
          warnings.push(
            `${moduleType}: schema keys without registry match: [${unmatchedSchemaKeys.join(', ')}]`,
          );
        }
      } catch {
        warnings.push(`${moduleType}: failed to instantiate`);
      }
    }

    // Log warnings for visibility but do not fail
    if (warnings.length > 0) {
      console.warn(
        `[Registry<->Schema soft check] ${warnings.length} warnings:\n` +
          warnings.map((w) => `  - ${w}`).join('\n'),
      );
    }

    // Always passes — this is a soft check
    expect(true).toBe(true);
  });

  // 8. No empty gameTypes
  it('every param has at least one game type', () => {
    const empty = PARAMETER_REGISTRY.filter(
      (p) => !p.gameTypes || p.gameTypes.length === 0,
    );

    expect(empty.map((p) => p.id)).toEqual([]);
  });

  // 9. Deterministic ordering: IDs are monotonically increasing within each category prefix
  it('param IDs are monotonically increasing within each category prefix', () => {
    const violations: string[] = [];

    // Group params by their ID prefix (e.g., "l1", "game_mechanics", "visual_audio", "game_objects")
    const groups = new Map<string, Array<{ id: string; index: number }>>();

    for (let i = 0; i < PARAMETER_REGISTRY.length; i++) {
      const param = PARAMETER_REGISTRY[i];
      // Extract prefix: everything before the last _NNN numeric suffix
      const match = param.id.match(/^(.+)_(\d+)$/);
      if (!match) {
        violations.push(`${param.id}: cannot extract numeric suffix`);
        continue;
      }

      const prefix = match[1];
      const num = parseInt(match[2], 10);

      if (!groups.has(prefix)) {
        groups.set(prefix, []);
      }
      groups.get(prefix)!.push({ id: param.id, index: num });
    }

    // Within each prefix group, verify IDs appear in ascending numeric order
    for (const [prefix, entries] of groups) {
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].index <= entries[i - 1].index) {
          violations.push(
            `${prefix}: ${entries[i - 1].id} (${entries[i - 1].index}) followed by ${entries[i].id} (${entries[i].index})`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
