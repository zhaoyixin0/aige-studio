import type { GameEngine, ModuleSchema } from '@/engine/core';
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

  private elapsed = 0;
  private ruleTimers: number[] = [];
  private currentScore = 0;
  private lastScoreMilestone = 0;

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
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const rules: DifficultyRule[] = this.params.rules ?? [];
    this.ruleTimers = rules.map(() => 0);

    if (this.params.mode === 'score') {
      this.on('scorer:update', (data?: any) => {
        if (data && typeof data.score === 'number') {
          this.currentScore = data.score;
        }
      });
    }
  }

  update(dt: number): void {
    const rules: DifficultyRule[] = this.params.rules ?? [];
    if (rules.length === 0) return;

    if (this.params.mode === 'time') {
      this.elapsed += dt / 1000; // convert ms to seconds

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        this.ruleTimers[i] += dt / 1000;

        while (this.ruleTimers[i] >= rule.every) {
          this.ruleTimers[i] -= rule.every;
          this.applyRule(rule);
        }
      }
    } else if (this.params.mode === 'score') {
      // Check each rule for score milestones
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const milestone = rule.every; // "every" is a score milestone
        while (this.currentScore >= this.lastScoreMilestone + milestone) {
          this.lastScoreMilestone += milestone;
          this.applyRule(rule);
        }
      }
    }
  }

  private applyRule(rule: DifficultyRule): void {
    const target = this.engine?.getModule(this.params.target);
    if (!target) return;

    const targetParams = target.getParams();
    let currentValue = targetParams[rule.field];

    if (typeof currentValue !== 'number') return;

    if (rule.increase != null) {
      currentValue += rule.increase;
    }
    if (rule.decrease != null) {
      currentValue -= rule.decrease;
    }

    // Clamp to bounds
    if (rule.min != null) {
      currentValue = Math.max(rule.min, currentValue);
    }
    if (rule.max != null) {
      currentValue = Math.min(rule.max, currentValue);
    }

    target.configure({ [rule.field]: currentValue });

    this.emit('difficulty:update', {
      field: rule.field,
      value: currentValue,
      target: this.params.target,
    });
  }

  reset(): void {
    this.elapsed = 0;
    this.ruleTimers = (this.params.rules ?? []).map(() => 0);
    this.currentScore = 0;
    this.lastScoreMilestone = 0;
  }
}
