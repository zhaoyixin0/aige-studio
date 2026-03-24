import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Knockback extends BaseModule {
  readonly type = 'Knockback';

  private active = false;
  private elapsed = 0;
  private direction: { x: number; y: number } = { x: 0, y: 0 };

  getSchema(): ModuleSchema {
    return {
      force: {
        type: 'range',
        label: 'Knockback Force',
        default: 300,
        min: 100,
        max: 800,
        step: 10,
      },
      duration: {
        type: 'range',
        label: 'Duration (ms)',
        default: 200,
        min: 50,
        max: 500,
        step: 10,
        unit: 'ms',
      },
      triggerEvent: {
        type: 'string',
        label: 'Trigger Event',
        default: 'collision:damage',
      },
      applyTo: {
        type: 'select',
        label: 'Apply To',
        default: 'player',
        options: ['player', 'items', 'all'],
      },
    };
  }

  getDependencies() { return { requires: ['Collision'], optional: [] }; }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.triggerEvent ?? 'collision:damage';
    this.on(trigger, (data?: any) => {
      this.activate(data);
    });
  }

  private activate(data?: any): void {
    const force = this.params.force ?? 300;

    // Compute direction from event data
    const dx = data?.x ?? 0;
    const dy = data?.y ?? 0;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude > 0) {
      this.direction = { x: dx / magnitude, y: dy / magnitude };
    } else {
      this.direction = { x: 1, y: 0 }; // default direction: push right
    }

    this.active = true;
    this.elapsed = 0;

    this.emit('knockback:start', {
      force,
      direction: { ...this.direction },
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.active) return;

    const duration = this.params.duration ?? 200;

    this.elapsed += dt;

    if (this.elapsed >= duration) {
      this.active = false;
      this.emit('knockback:end');
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getDirection(): { x: number; y: number } {
    return { ...this.direction };
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.direction = { x: 0, y: 0 };
  }
}
