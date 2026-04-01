import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

/**
 * ComboSystem provides combo event signaling for the engine.
 *
 * It listens to `scorer:update` events and tracks combos independently from Scorer's
 * built-in combo logic. This is intentional — Scorer's combo affects score calculation
 * (multiplier array applied to deltas), while ComboSystem emits `combo:hit` and
 * `combo:break` events for other modules to consume (visual effects, HUD, sound, etc.).
 * The two may have different combo windows and multiplier formulas by design.
 */
export class ComboSystem extends BaseModule {
  readonly type = 'ComboSystem';

  private comboCount = 0;
  private lastHitTime = 0;

  getSchema(): ModuleSchema {
    return {
      comboWindow: {
        type: 'range',
        label: 'Combo Window (ms)',
        default: 2000,
        min: 500,
        max: 5000,
        step: 100,
        unit: 'ms',
      },
      multiplierStep: {
        type: 'range',
        label: 'Multiplier Step',
        default: 0.5,
        min: 0.1,
        max: 1,
        step: 0.1,
      },
      maxMultiplier: {
        type: 'range',
        label: 'Max Multiplier',
        default: 5,
        min: 2,
        max: 10,
        step: 0.5,
      },
    };
  }

  getDependencies() { return { requires: ['Scorer'], optional: [] }; }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'combo:hit',
        'combo:break',
      ],
      consumes: [
        'scorer:update',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('scorer:update', (data?: any) => {
      if (data && typeof data.delta === 'number' && data.delta > 0) {
        this.onHit();
      }
    });
  }

  private onHit(): void {
    const now = performance.now();
    const window = this.params.comboWindow ?? 2000;

    if (now - this.lastHitTime <= window) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastHitTime = now;

    const multiplierStep = this.params.multiplierStep ?? 0.5;
    const maxMultiplier = this.params.maxMultiplier ?? 5;
    const multiplier = Math.min(
      1 + (this.comboCount - 1) * multiplierStep,
      maxMultiplier,
    );

    this.emit('combo:hit', {
      count: this.comboCount,
      multiplier,
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (this.comboCount === 0) return;

    const window = this.params.comboWindow ?? 2000;
    const now = performance.now();

    if (now - this.lastHitTime > window) {
      this.comboCount = 0;
      this.emit('combo:break');
    }

    void dt;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getMultiplier(): number {
    const multiplierStep = this.params.multiplierStep ?? 0.5;
    const maxMultiplier = this.params.maxMultiplier ?? 5;
    if (this.comboCount === 0) return 1;
    return Math.min(
      1 + (this.comboCount - 1) * multiplierStep,
      maxMultiplier,
    );
  }

  reset(): void {
    this.comboCount = 0;
    this.lastHitTime = 0;
  }
}
