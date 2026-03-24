import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Dash extends BaseModule {
  readonly type = 'Dash';

  private active = false;
  private elapsed = 0;
  private cooldownRemaining = 0;
  private currentDirection: { x: number; y: number } = { x: 0, y: 0 };
  private displacement: { x: number; y: number } = { x: 0, y: 0 };

  getSchema(): ModuleSchema {
    return {
      distance: {
        type: 'range',
        label: 'Dash Distance',
        default: 150,
        min: 50,
        max: 400,
        step: 10,
      },
      duration: {
        type: 'range',
        label: 'Duration (ms)',
        default: 150,
        min: 50,
        max: 300,
        step: 10,
        unit: 'ms',
      },
      cooldown: {
        type: 'range',
        label: 'Cooldown (ms)',
        default: 500,
        min: 0,
        max: 2000,
        step: 50,
        unit: 'ms',
      },
      triggerEvent: {
        type: 'string',
        label: 'Trigger Event',
        default: 'input:touch:doubleTap',
      },
      directionSource: {
        type: 'select',
        label: 'Direction Source',
        default: 'facing',
        options: ['facing', 'input', 'fixed'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.triggerEvent ?? 'input:touch:doubleTap';
    this.on(trigger, (data?: any) => {
      this.tryDash(data);
    });
  }

  private tryDash(data?: any): void {
    if (this.active || this.cooldownRemaining > 0) return;

    const directionSource = this.params.directionSource ?? 'facing';

    // Determine direction based on source
    if (directionSource === 'input' && data) {
      const dx = data.x ?? 0;
      const dy = data.y ?? 0;
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude > 0) {
        this.currentDirection = { x: dx / magnitude, y: dy / magnitude };
      } else {
        this.currentDirection = { x: 1, y: 0 };
      }
    } else if (directionSource === 'fixed') {
      this.currentDirection = { x: 1, y: 0 };
    } else {
      // 'facing' — default to right
      this.currentDirection = { x: 1, y: 0 };
    }

    this.active = true;
    this.elapsed = 0;
    this.displacement = { x: 0, y: 0 };

    this.emit('dash:start', {
      direction: { ...this.currentDirection },
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    // Decrement cooldown
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }

    if (!this.active) return;

    const distance = this.params.distance ?? 150;
    const duration = this.params.duration ?? 150;

    this.elapsed += dt;

    // Compute displacement based on elapsed time
    const progress = Math.min(this.elapsed / duration, 1);
    this.displacement = {
      x: this.currentDirection.x * distance * progress,
      y: this.currentDirection.y * distance * progress,
    };

    if (this.elapsed >= duration) {
      this.active = false;
      this.cooldownRemaining = this.params.cooldown ?? 500;

      this.emit('dash:end', {
        displacement: { ...this.displacement },
      });
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getDisplacement(): { x: number; y: number } {
    return { ...this.displacement };
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.cooldownRemaining = 0;
    this.currentDirection = { x: 0, y: 0 };
    this.displacement = { x: 0, y: 0 };
  }
}
