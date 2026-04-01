import type { GameEngine, GameModule, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

function hasIsActive(m: GameModule): m is GameModule & { isActive(type?: string): boolean } {
  return typeof (m as any).isActive === 'function';
}

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

  getDependencies() { return { requires: ['Collision'], optional: [] }; }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'lives:change',
        'lives:zero',
      ],
      consumes: [
        'collision:damage',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.current = this.params.count;

    this.on('collision:damage', () => {
      // Skip damage during invincibility frames
      if (this.isInvincible()) return;

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

  private isInvincible(): boolean {
    if (!this.engine) return false;

    // Check IFrames
    const iframes = this.engine.getModulesByType('IFrames');
    if (iframes.length > 0 && hasIsActive(iframes[0]) && iframes[0].isActive()) {
      return true;
    }

    // Check PowerUp shield
    const powerUps = this.engine.getModulesByType('PowerUp');
    if (powerUps.length > 0 && hasIsActive(powerUps[0]) && powerUps[0].isActive('shield')) {
      return true;
    }

    return false;
  }

  reset(): void {
    this.current = this.params.count;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }
}
