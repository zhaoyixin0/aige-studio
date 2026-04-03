import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class IFrames extends BaseModule {
  readonly type = 'IFrames';

  private active = false;
  private elapsed = 0;

  getSchema(): ModuleSchema {
    return {
      duration: {
        type: 'range',
        label: 'Duration',
        default: 1000,
        min: 200,
        max: 3000,
        step: 100,
        unit: 'ms',
      },
      triggerEvent: {
        type: 'string',
        label: 'Trigger Event',
        default: 'collision:damage',
      },
      flashEffect: {
        type: 'boolean',
        label: 'Flash Effect',
        default: true,
      },
    };
  }

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    const trigger = (this.params.triggerEvent as string) ?? 'collision:damage';
    return {
      emits: ['iframes:start', 'iframes:end'],
      consumes: [trigger],
    };
  }

  getDependencies() { return { requires: ['Collision'], optional: [] }; }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on(this.params.triggerEvent as string, () => {
      if (!this.active) {
        this.active = true;
        this.elapsed = 0;
        this.emit('iframes:start', { duration: this.params.duration as number });
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.active) return;

    this.elapsed += dt;

    if (this.elapsed >= (this.params.duration as number)) {
      this.active = false;
      this.emit('iframes:end');
    }
  }

  isActive(): boolean {
    return this.active;
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
