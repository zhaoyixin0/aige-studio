import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Jump extends BaseModule {
  readonly type = 'Jump';

  private y = 0;
  private velocityY = 0;
  private grounded = true;
  private peakReached = false;

  getSchema(): ModuleSchema {
    return {
      jumpForce: {
        type: 'range',
        label: 'Jump Force',
        default: 500,
        min: 100,
        max: 1000,
        step: 10,
      },
      gravity: {
        type: 'range',
        label: 'Gravity',
        default: 980,
        min: 200,
        max: 2000,
        step: 10,
      },
      groundY: {
        type: 'range',
        label: 'Ground Y (0–1)',
        default: 0.8,
        min: 0,
        max: 1,
        step: 0.05,
      },
      triggerEvent: {
        type: 'select',
        label: 'Trigger Event',
        default: 'input:touch:tap',
        options: ['input:touch:tap', 'input:face:mouthOpen'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const groundY = this.params.groundY ?? 0.8;
    this.y = groundY;
    this.grounded = true;

    const trigger = this.params.triggerEvent ?? 'touch:tap';
    this.on(trigger, () => {
      this.triggerJump();
    });
  }

  triggerJump(): void {
    if (!this.grounded) return;

    const jumpForce = this.params.jumpForce ?? 500;
    this.velocityY = -jumpForce / 1000; // normalize to per-ms units
    this.grounded = false;
    this.peakReached = false;

    this.emit('jump:start', { y: this.y });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (this.grounded) return;

    const gravity = (this.params.gravity ?? 980) / 1000; // per-ms units
    const groundY = this.params.groundY ?? 0.8;

    // Apply gravity
    this.velocityY += gravity * (dt / 1000);

    // Move
    this.y += this.velocityY * (dt / 1000);

    // Detect peak
    if (!this.peakReached && this.velocityY >= 0) {
      this.peakReached = true;
      this.emit('jump:peak', { y: this.y });
    }

    // Detect landing
    if (this.y >= groundY) {
      this.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
      this.emit('jump:land', { y: this.y });
    }
  }

  getY(): number {
    return this.y;
  }

  isGrounded(): boolean {
    return this.grounded;
  }

  reset(): void {
    const groundY = this.params.groundY ?? 0.8;
    this.y = groundY;
    this.velocityY = 0;
    this.grounded = true;
    this.peakReached = false;
  }
}
