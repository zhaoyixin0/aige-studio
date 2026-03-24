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
    };
  }

  getDependencies() { return { requires: ['Collision'], optional: ['ComboSystem'] }; }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on(this.params.hitEvent ?? 'collision:hit', () => this.onHit());

    if (this.params.deductOnMiss) {
      this.on('spawner:destroyed', () => this.onMiss());
    }
  }

  private onHit(): void {
    const now = performance.now();
    const combo = this.params.combo ?? this.getSchema().combo.default;

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

    const delta = Math.round(this.params.perHit * multiplier);
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
    const combo = this.params.combo;
    if (combo?.enabled && this.comboCount > 0) {
      const now = performance.now();
      if (now - this.lastHitTime > combo.window) {
        this.comboCount = 0;
      }
    }
    // dt is used implicitly via time-based combo tracking
    void dt;
  }

  getScore(): number {
    return this.score;
  }

  reset(): void {
    this.score = 0;
    this.comboCount = 0;
    this.lastHitTime = 0;
  }
}
