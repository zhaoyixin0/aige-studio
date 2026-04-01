import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

type ScalingCurve = 'linear' | 'quadratic' | 'exponential';

export class LevelUp extends BaseModule {
  readonly type = 'LevelUp';

  private level = 1;
  private currentXp = 0;
  private totalXp = 0;
  private skillPoints = 0;

  getSchema(): ModuleSchema {
    return {
      xpPerLevel: {
        type: 'range',
        label: 'XP Per Level (base)',
        default: 100,
        min: 10,
        max: 10000,
        step: 10,
      },
      scalingCurve: {
        type: 'select',
        label: 'Scaling Curve',
        default: 'quadratic',
        options: ['linear', 'quadratic', 'exponential'],
      },
      maxLevel: {
        type: 'range',
        label: 'Max Level',
        default: 50,
        min: 1,
        max: 999,
        step: 1,
      },
      xpSource: {
        type: 'string',
        label: 'XP Source Event',
        default: 'enemy:death',
      },
      xpAmount: {
        type: 'range',
        label: 'XP Per Event',
        default: 10,
        min: 1,
        max: 1000,
        step: 1,
      },
      statGrowth: {
        type: 'object',
        label: 'Stat Growth Per Level',
        default: { hp: 10, attack: 2, defense: 1 },
      },
    };
  }

  getContracts(): ModuleContracts {
    const xpSource: string = this.params.xpSource ?? 'enemy:death';
    return {
      emits: ['levelup:xp', 'levelup:levelup'],
      consumes: [xpSource],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const xpSource: string = this.params.xpSource ?? 'enemy:death';
    this.on(xpSource, (data?: any) => {
      const amount =
        data && typeof data.amount === 'number'
          ? data.amount
          : (this.params.xpAmount ?? 10);
      this.addXp(amount);
    });
  }

  private getXpThreshold(forLevel: number): number {
    const base: number = this.params.xpPerLevel ?? 100;
    const curve: ScalingCurve = this.params.scalingCurve ?? 'quadratic';

    if (curve === 'linear') return base * forLevel;
    if (curve === 'quadratic') return Math.floor(base * Math.pow(forLevel, 1.5));
    // exponential
    return Math.floor(base * Math.pow(1.5, forLevel));
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    const maxLevel: number = this.params.maxLevel ?? 50;

    this.currentXp += amount;
    this.totalXp += amount;

    this.emit('levelup:xp', {
      xp: this.currentXp,
      totalXp: this.totalXp,
      level: this.level,
      xpToNext: this.getXpToNextLevel(),
    });

    while (this.level < maxLevel) {
      const threshold = this.getXpThreshold(this.level);
      if (this.currentXp < threshold) break;

      this.currentXp -= threshold;
      this.level++;
      this.skillPoints++;

      this.emit('levelup:levelup', {
        level: this.level,
        stats: this.getStats(),
        skillPoints: this.skillPoints,
      });
    }

    // At max level, drain excess XP
    if (this.level >= maxLevel) {
      this.currentXp = 0;
    }
  }

  getLevel(): number {
    return this.level;
  }

  getXp(): number {
    return this.currentXp;
  }

  getXpToNextLevel(): number {
    const maxLevel: number = this.params.maxLevel ?? 50;
    if (this.level >= maxLevel) return 0;
    return this.getXpThreshold(this.level) - this.currentXp;
  }

  getSkillPoints(): number {
    return this.skillPoints;
  }

  getStats(): Record<string, number> {
    const growth: Record<string, number> = this.params.statGrowth ?? { hp: 10, attack: 2, defense: 1 };
    const result: Record<string, number> = {};
    for (const [stat, baseValue] of Object.entries(growth)) {
      result[stat] = baseValue * this.level;
    }
    return result;
  }

  reset(): void {
    this.level = 1;
    this.currentXp = 0;
    this.totalXp = 0;
    this.skillPoints = 0;
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
  }
}
