import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class CoyoteTime extends BaseModule {
  readonly type = 'CoyoteTime';

  private coyoteTimer = 0;
  private bufferTimer = 0;
  private grounded = true;
  private jumpBuffered = false;

  getSchema(): ModuleSchema {
    return {
      coyoteFrames: {
        type: 'range',
        label: 'Coyote Frames',
        default: 6,
        min: 3,
        max: 15,
        step: 1,
      },
      bufferFrames: {
        type: 'range',
        label: 'Buffer Frames',
        default: 6,
        min: 3,
        max: 15,
        step: 1,
      },
      jumpEvent: {
        type: 'string',
        label: 'Jump Event',
        default: 'input:touch:tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('gravity:falling', () => {
      if (this.grounded) {
        this.grounded = false;
        this.coyoteTimer = this.params.coyoteFrames * 16;
      }
    });

    this.on('gravity:landed', () => {
      this.grounded = true;
      this.coyoteTimer = 0;

      if (this.jumpBuffered && this.bufferTimer > 0) {
        this.emit('coyote:jump');
        this.jumpBuffered = false;
        this.bufferTimer = 0;
      }
    });

    this.on(this.params.jumpEvent, () => {
      if (this.grounded || this.coyoteTimer > 0) {
        this.emit('coyote:jump');
        this.coyoteTimer = 0;
      } else {
        this.jumpBuffered = true;
        this.bufferTimer = this.params.bufferFrames * 16;
      }
    });
  }

  update(dt: number): void {
    if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
      if (this.coyoteTimer < 0) {
        this.coyoteTimer = 0;
      }
    }

    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.bufferTimer <= 0) {
        this.bufferTimer = 0;
        this.jumpBuffered = false;
      }
    }
  }

  reset(): void {
    this.coyoteTimer = 0;
    this.bufferTimer = 0;
    this.grounded = true;
    this.jumpBuffered = false;
  }
}
