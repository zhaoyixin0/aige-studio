import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class PlayerMovement extends BaseModule {
  readonly type = 'PlayerMovement';

  private x = 0;
  private velocityX = 0;
  private direction: -1 | 0 | 1 = 0;
  private inputActive = false;
  private wasStopped = true;

  getSchema(): ModuleSchema {
    return {
      speed: {
        type: 'range',
        label: 'Speed',
        default: 300,
        min: 100,
        max: 800,
        step: 10,
      },
      acceleration: {
        type: 'range',
        label: 'Acceleration',
        default: 1000,
        min: 0,
        max: 2000,
        step: 10,
      },
      deceleration: {
        type: 'range',
        label: 'Deceleration',
        default: 800,
        min: 0,
        max: 2000,
        step: 10,
      },
      moveLeftEvent: {
        type: 'string',
        label: 'Move Left Event',
        default: 'input:touch:swipe:left',
      },
      moveRightEvent: {
        type: 'string',
        label: 'Move Right Event',
        default: 'input:touch:swipe:right',
      },
      continuousEvent: {
        type: 'string',
        label: 'Continuous Event',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const moveLeftEvent = this.params.moveLeftEvent ?? 'input:touch:swipe:left';
    const moveRightEvent = this.params.moveRightEvent ?? 'input:touch:swipe:right';

    this.on(moveLeftEvent, () => {
      this.direction = -1;
      this.inputActive = true;
    });

    this.on(moveRightEvent, () => {
      this.direction = 1;
      this.inputActive = true;
    });

    const continuousEvent = this.params.continuousEvent;
    if (continuousEvent) {
      this.on(continuousEvent, (data?: any) => {
        if (data && typeof data.x === 'number') {
          const canvasWidth = this.engine?.getCanvas().width ?? 800;
          this.x = data.x * canvasWidth;
        }
      });
    }
  }

  update(dt: number): void {
    const speed = this.params.speed ?? 300;
    const acceleration = this.params.acceleration ?? 1000;
    const deceleration = this.params.deceleration ?? 800;
    const dtSec = dt / 1000;

    if (this.inputActive) {
      // Accelerate toward direction * speed
      const targetVelocity = this.direction * speed;
      const diff = targetVelocity - this.velocityX;

      if (Math.abs(diff) < acceleration * dtSec) {
        this.velocityX = targetVelocity;
      } else {
        this.velocityX += Math.sign(diff) * acceleration * dtSec;
      }

      // Consume input — one-shot per event, not continuous hold
      this.inputActive = false;
    } else {
      // Decelerate toward 0
      if (this.velocityX > 0) {
        this.velocityX = Math.max(0, this.velocityX - deceleration * dtSec);
      } else if (this.velocityX < 0) {
        this.velocityX = Math.min(0, this.velocityX + deceleration * dtSec);
      }
    }

    // Cap at max speed
    if (Math.abs(this.velocityX) > speed) {
      this.velocityX = Math.sign(this.velocityX) * speed;
    }

    // Update position
    this.x += this.velocityX * dtSec;

    // Emit events
    if (this.velocityX !== 0) {
      this.wasStopped = false;
      this.emit('player:move', {
        x: this.x,
        direction: this.direction,
        speed: Math.abs(this.velocityX),
      });
    } else if (!this.wasStopped) {
      this.wasStopped = true;
      this.emit('player:stop', { x: this.x });
    }
  }

  getX(): number {
    return this.x;
  }

  getVelocityX(): number {
    return this.velocityX;
  }

  reset(): void {
    this.x = 0;
    this.velocityX = 0;
    this.direction = 0;
    this.inputActive = false;
    this.wasStopped = true;
  }
}
