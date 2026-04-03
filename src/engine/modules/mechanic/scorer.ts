import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

/**
 * Scorer tracks score and has optional built-in combo tracking for score multipliers.
 *
 * Note on combo duplication with ComboSystem:
 * Scorer's combo logic applies multipliers to score deltas internally (via the
 * `combo.multiplier` array). ComboSystem is a separate module that listens to
 * `scorer:update` and emits `combo:hit` / `combo:break` events for other modules
 * (e.g., visual feedback, HUD). The two track combos independently with potentially
 * different windows and multiplier formulas — this is intentional. They don't conflict:
 * Scorer owns score calculation, ComboSystem owns combo signaling to the rest of the engine.
 */
export class Scorer extends BaseModule {
  readonly type = 'Scorer';

  private score = 0;
  private comboCount = 0;
  private lastHitTime = 0;
  private scoreAccumulator = 0;

  getSchema(): ModuleSchema {
    return {
      perHit: {
        type: 'number',
        label: 'Points per Hit',
        default: 10,
        min: 1,
      },
      combo: {
        type: 'object',
        label: 'Combo',
        default: { enabled: false, window: 1000, multiplier: [1, 1.5, 2] },
        fields: {
          enabled: { type: 'boolean', label: 'Enabled', default: false },
          window: {
            type: 'number',
            label: 'Window (ms)',
            default: 1000,
            min: 100,
          },
          multiplier: {
            type: 'object',
            label: 'Multiplier Array',
            default: [1, 1.5, 2],
          },
        },
      },
      deductOnMiss: {
        type: 'boolean',
        label: 'Deduct on Miss',
        default: false,
      },
      deductAmount: {
        type: 'number',
        label: 'Deduct Amount',
        default: 5,
        min: 0,
      },
      hitEvent: {
        type: 'string',
        label: 'Score Event',
        default: 'collision:hit',
      },
      scorePerSecond: {
        type: 'number',
        label: 'Score Per Second (survival)',
        default: 0,
        min: 0,
      },
      comboWindow: {
        type: 'number',
        label: 'Combo Window (s)',
        default: 2,
        min: 0.5,
        max: 10,
      },
      comboMultiplierStep: {
        type: 'number',
        label: 'Combo Multiplier Step',
        default: 0.5,
        min: 0.1,
        max: 5,
      },
      critMultiplier: {
        type: 'number',
        label: 'Crit Multiplier',
        default: 2,
        min: 1,
        max: 10,
      },
    };
  }

  getDependencies() {
    const hitEvent = (this.params.hitEvent as string) ?? 'collision:hit';
    const requires = hitEvent.startsWith('collision:') ? ['Collision'] : [];
    return { requires, optional: ['ComboSystem'] };
  }

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    const hitEvent = (this.params.hitEvent as string) ?? 'collision:hit';
    return {
      emits: ['scorer:update'],
      consumes: [hitEvent, 'spawner:destroyed', 'gameflow:resume', 'gameflow:pause'],
      capabilities: ['scoring-core'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on((this.params.hitEvent as string) ?? 'collision:hit', () => this.onHit());

    if (this.params.deductOnMiss) {
      this.on('spawner:destroyed', () => this.onMiss());
    }
  }

  private onHit(): void {
    const now = performance.now();
    const combo = (this.params.combo as { enabled: boolean; window: number; multiplier: number[] }) ?? this.getSchema().combo.default;

    if (combo.enabled) {
      // Check if within combo window
      if (now - this.lastHitTime <= combo.window) {
        this.comboCount++;
      } else {
        this.comboCount = 1;
      }
      this.lastHitTime = now;
    } else {
      this.comboCount = 1;
    }

    const multiplierArray: number[] = combo.multiplier ?? [1];
    const multiplierIndex = Math.min(
      this.comboCount - 1,
      multiplierArray.length - 1,
    );
    const multiplier = multiplierArray[multiplierIndex] ?? 1;

    const delta = Math.round((this.params.perHit as number) * multiplier);
    this.score += delta;

    this.emit('scorer:update', {
      score: this.score,
      delta,
      combo: this.comboCount,
    });

    if (this.comboCount >= 3) {
      this.emit(`scorer:combo:${this.comboCount}`, { combo: this.comboCount });
    }
  }

  private onMiss(): void {
    if (!this.params.deductOnMiss) return;
    const delta = -(this.params.deductAmount ?? 5);
    this.score = Math.max(0, this.score + delta);

    this.emit('scorer:update', {
      score: this.score,
      delta,
      combo: 0,
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    // Check combo timeout — reset combo if window has elapsed
    const combo = this.params.combo as { enabled: boolean; window: number; multiplier: number[] } | undefined;
    if (combo?.enabled && this.comboCount > 0) {
      const now = performance.now();
      if (now - this.lastHitTime > combo.window) {
        this.comboCount = 0;
      }
    }
    // Survival scoring: accumulate fractional points, emit when crossing whole number
    const scorePerSecond = (this.params.scorePerSecond as number) ?? 0;
    if (scorePerSecond > 0) {
      this.scoreAccumulator += (scorePerSecond as number) * (dt / 1000);
      const delta = Math.floor(this.scoreAccumulator);
      if (delta >= 1) {
        this.scoreAccumulator -= delta;
        this.score += delta;
        this.emit('scorer:update', { score: this.score, delta, combo: 0 });
      }
    }
  }

  getScore(): number {
    return this.score;
  }

  reset(): void {
    this.score = 0;
    this.comboCount = 0;
    this.lastHitTime = 0;
    this.scoreAccumulator = 0;
  }
}
