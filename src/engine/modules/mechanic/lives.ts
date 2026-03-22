import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Lives extends BaseModule {
  readonly type = 'Lives';

  private current = 0;

  getSchema(): ModuleSchema {
    return {
      count: {
        type: 'number',
        label: 'Lives',
        default: 3,
        min: 1,
        max: 10,
      },
      events: {
        type: 'object',
        label: 'Events',
        default: { damage: -1 },
        fields: {
          damage: {
            type: 'number',
            label: 'Damage Amount',
            default: -1,
          },
        },
      },
      onZero: {
        type: 'select',
        label: 'On Zero',
        default: 'finish',
        options: ['finish', 'none'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.current = this.params.count;

    this.on('collision:damage', () => {
      const amount = Math.abs(this.params.events?.damage ?? 1);
      this.decrease(amount);
    });
  }

  decrease(amount: number): void {
    if (this.current <= 0) return;

    this.current = Math.max(0, this.current - amount);

    this.emit('lives:change', {
      current: this.current,
      max: this.params.count,
    });

    if (this.current === 0) {
      this.emit('lives:zero');
    }
  }

  increase(amount: number): void {
    this.current = Math.min(this.params.count, this.current + amount);

    this.emit('lives:change', {
      current: this.current,
      max: this.params.count,
    });
  }

  getCurrent(): number {
    return this.current;
  }

  reset(): void {
    this.current = this.params.count;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }
}
