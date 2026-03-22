import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Timer extends BaseModule {
  readonly type = 'Timer';

  private elapsed = 0;
  private paused = false;
  private ended = false;
  private lastTickSecond = 0;

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

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('gameflow:pause', () => {
      this.paused = true;
    });
    this.on('gameflow:resume', () => {
      this.paused = false;
    });
  }

  update(dt: number): void {
    if (this.paused || this.ended) return;

    const durationMs = this.params.duration * 1000;

    // Advance elapsed, but clamp to duration for countdown
    if (this.params.mode === 'countdown') {
      this.elapsed = Math.min(this.elapsed + dt, durationMs);
    } else {
      this.elapsed += dt;
    }

    // Emit timer:tick every full second boundary
    const currentSecond = Math.floor(this.elapsed / 1000);
    while (this.lastTickSecond < currentSecond) {
      this.lastTickSecond++;
      const elapsedSec = this.lastTickSecond;
      const remainingSec =
        this.params.mode === 'countdown'
          ? Math.max(0, this.params.duration - elapsedSec)
          : 0;

      this.emit('timer:tick', {
        remaining: remainingSec,
        elapsed: elapsedSec,
      });
    }

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
    this.paused = false;
    this.ended = false;
    this.lastTickSecond = 0;
  }
}
