import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class WallDetect extends BaseModule {
  readonly type = 'WallDetect';

  private touching = false;
  private side: 'left' | 'right' | null = null;

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    const wallJumpEvent = (this.params.wallJumpEvent as string) ?? 'input:touch:tap';
    return {
      emits: ['wall:contact', 'wall:jump', 'wall:slide'],
      consumes: this.params.wallJump !== false ? [wallJumpEvent] : [],
    };
  }

  getSchema(): ModuleSchema {
    return {
      wallSlide: {
        type: 'boolean',
        label: 'Wall Slide',
        default: true,
      },
      slideSpeed: {
        type: 'range',
        label: 'Slide Speed',
        default: 100,
        min: 50,
        max: 300,
        step: 10,
      },
      wallJump: {
        type: 'boolean',
        label: 'Wall Jump',
        default: true,
      },
      wallJumpForce: {
        type: 'object',
        label: 'Wall Jump Force',
        default: { x: 400, y: 600 },
        fields: {
          x: { type: 'range', label: 'Force X', default: 400, min: 200, max: 600, step: 10 },
          y: { type: 'range', label: 'Force Y', default: 600, min: 300, max: 800, step: 10 },
        },
      },
      wallJumpEvent: {
        type: 'string',
        label: 'Wall Jump Event',
        default: 'input:touch:tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const wallJump = this.params.wallJump;
    if (wallJump !== false) {
      const event = this.params.wallJumpEvent ?? 'input:touch:tap';
      this.on(event, () => {
        this.tryWallJump();
      });
    }
  }

  setWallContact(side: 'left' | 'right'): void {
    this.touching = true;
    this.side = side;
    this.emit('wall:contact', { side });
  }

  clearWallContact(): void {
    this.touching = false;
    this.side = null;
  }

  isTouchingWall(): boolean {
    return this.touching;
  }

  getWallSide(): 'left' | 'right' | null {
    return this.side;
  }

  getSlideSpeed(): number {
    return this.params.slideSpeed ?? 100;
  }

  tryWallJump(): void {
    if (!this.touching) return;

    const force = this.params.wallJumpForce ?? { x: 400, y: 600 };
    const awaySide = this.side === 'left' ? 'right' : 'left';

    this.emit('wall:jump', {
      forceX: force.x,
      forceY: force.y,
      awaySide,
      fromSide: this.side,
    });

    this.clearWallContact();
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
    if (this.touching && this.params.wallSlide) {
      this.emit('wall:slide', {
        side: this.side,
        speed: this.params.slideSpeed ?? 100,
      });
    }
  }

  reset(): void {
    this.touching = false;
    this.side = null;
  }
}
