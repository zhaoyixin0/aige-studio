import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface DifficultyRule {
  every: number;       // seconds between adjustments
  field: string;       // param path on target module
  increase?: number;   // amount to add
  decrease?: number;   // amount to subtract
  min?: number;
  max?: number;
}

export class DifficultyRamp extends BaseModule {
  readonly type = 'DifficultyRamp';

  private ruleTimers: number[] = [];
  private currentScore = 0;
  private ruleMilestones: number[] = [];
  private warnedMissingTarget = false;

  getSchema(): ModuleSchema {
    return {
      target: {
        type: 'string',
        label: '目标模块ID',
        default: '',
      },
      rules: {
        type: 'object',
        label: '递增规则',
        default: [],
      },
      mode: {
        type: 'select',
        label: '触发模式',
        options: ['time', 'score'],
        default: 'time',
      },
      initialDifficulty: {
        type: 'number',
        label: 'Initial Difficulty',
        default: 1,
        min: 0,
        max: 20,
      },
      maxDifficulty: {
        type: 'number',
        label: 'Max Difficulty',
        default: 10,
        min: 1,
        max: 100,
      },
    };
  }

  getDependencies() { return { requires: [], optional: ['Scorer'] }; }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'difficulty:update',
      ],
      consumes: [
        'scorer:update',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const rules: DifficultyRule[] = (this.params.rules as DifficultyRule[]) ?? [];
    this.ruleTimers = rules.map(() => 0);
    this.ruleMilestones = rules.map(() => 0);

    if (this.params.mode === 'score') {
      this.on('scorer:update', (data?: any) => {
        if (data && typeof data.score === 'number') {
          this.currentScore = data.score;
        }
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    const rules: DifficultyRule[] = (this.params.rules as DifficultyRule[]) ?? [];
    if (rules.length === 0) return;

    if (this.params.mode === 'time') {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        this.ruleTimers[i] += dt / 1000;

        while (this.ruleTimers[i] >= rule.every) {
          this.ruleTimers[i] -= rule.every;
          this.applyRule(rule);
        }
      }
    } else if (this.params.mode === 'score') {
      // Check each rule independently for score milestones
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const milestone = rule.every; // "every" is a score milestone
        while (this.currentScore >= this.ruleMilestones[i] + milestone) {
          this.ruleMilestones[i] += milestone;
          this.applyRule(rule);
        }
      }
    }
  }

  private applyRule(rule: DifficultyRule): void {
    const target = this.engine?.getModule(this.params.target as string);
    if (!target) {
      if (!this.warnedMissingTarget) {
        console.warn(`[DifficultyRamp] Target module "${this.params.target}" not found`);
        this.warnedMissingTarget = true;
      }
      return;
    }

    const targetParams = target.getParams();
    let currentValue = getNestedValue(targetParams, rule.field);

    if (typeof currentValue !== 'number') return;

    if (rule.increase != null) {
      currentValue += rule.increase;
    }
    if (rule.decrease != null) {
      currentValue -= rule.decrease;
    }

    // Clamp to bounds
    if (rule.min != null) {
      currentValue = Math.max(rule.min, currentValue as number);
    }
    if (rule.max != null) {
      currentValue = Math.min(rule.max, currentValue as number);
    }

    // Support dot-path: build update that preserves sibling keys
    const update = buildNestedUpdate(targetParams, rule.field, currentValue as number);
    target.configure(update);

    this.emit('difficulty:update', {
      field: rule.field,
      value: currentValue,
      target: this.params.target,
    });
  }

  reset(): void {
    this.ruleTimers = ((this.params.rules as DifficultyRule[]) ?? []).map(() => 0);
    this.ruleMilestones = ((this.params.rules as DifficultyRule[]) ?? []).map(() => 0);
    this.currentScore = 0;
    this.warnedMissingTarget = false;
  }
}

/** Read a value from a nested object using dot-path (e.g. "speed.min") */
function getNestedValue(obj: Record<string, any>, path: string): unknown {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

/** Build update object preserving sibling keys for nested paths.
 *  "frequency", 0.5 → { frequency: 0.5 }
 *  "speed.min", 150 (with existing speed: {min:100, max:200}) → { speed: {min:150, max:200} }
 */
function buildNestedUpdate(
  existingParams: Record<string, any>,
  path: string,
  value: number,
): Record<string, any> {
  const keys = path.split('.');
  if (keys.length === 1) return { [keys[0]]: value };

  if (keys.length > 2) {
    console.warn(`[DifficultyRamp] Dot-path deeper than 2 levels not supported: "${path}". Only top.leaf is allowed.`);
  }

  // For dot-path, spread the existing sub-object and override the leaf key
  const topKey = keys[0];
  const leafKey = keys[keys.length - 1];
  const existing = existingParams[topKey];
  const base = typeof existing === 'object' && existing !== null ? { ...existing } : {};
  base[leafKey] = value;
  return { [topKey]: base };
}
