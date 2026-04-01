import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export class Timer extends BaseModule {
  readonly type = 'Timer';

  private elapsed = 0;
  private ended = false;
  // lastTickSecond removed: was unused

  getSchema(): ModuleSchema {
    return {
      mode: {
        type: 'select',
        label: 'Mode',
        default: 'countdown',
        options: ['countdown', 'stopwatch'],
      },
      duration: {
        type: 'range',
        label: 'Duration (s)',
        default: 30,
        min: 5,
        max: 300,
        step: 1,
        unit: 's',
      },
      onEnd: {
        type: 'select',
        label: 'On End',
        default: 'finish',
        options: ['finish', 'none'],
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'timer:tick',
        'timer:end',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
  }

  update(dt: number): void {
    if (this.gameflowPaused || this.ended) return;

    const durationMs = this.params.duration * 1000;

    // Advance elapsed, but clamp to duration for countdown
    if (this.params.mode === 'countdown') {
      this.elapsed = Math.min(this.elapsed + dt, durationMs);
    } else {
      this.elapsed += dt;
    }

    // Emit timer:tick every frame with current time values
    const elapsedSec = this.elapsed / 1000;
    const remainingSec =
      this.params.mode === 'countdown'
        ? Math.max(0, this.params.duration - elapsedSec)
        : 0;

    this.emit('timer:tick', {
      remaining: remainingSec,
      elapsed: elapsedSec,
    });

    // Check for countdown end
    if (this.params.mode === 'countdown' && this.elapsed >= durationMs && !this.ended) {
      this.ended = true;
      this.emit('timer:end');
    }
  }

  getRemaining(): number {
    if (this.params.mode === 'countdown') {
      return Math.max(0, this.params.duration - this.elapsed / 1000);
    }
    return 0;
  }

  getElapsed(): number {
    return this.elapsed / 1000;
  }

  reset(): void {
    this.elapsed = 0;
    this.ended = false;

  }
}
