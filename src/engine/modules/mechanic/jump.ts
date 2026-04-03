import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import type { Gravity } from './gravity';
import { BaseModule } from '../base-module';

export class Jump extends BaseModule {
  readonly type = 'Jump';

  private y = 0;
  private velocityY = 0;
  private grounded = true;
  private peakReached = false;
  /** Prevents jump:release from cutting velocity on the same frame as triggerJump */
  private justJumped = false;
  /** When Gravity module is present, delegate physics to it */
  private gravity: Gravity | null = null;
  private canvasWidth = 1080;
  private canvasHeight = 1920;

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
      doubleJumpWindow: {
        type: 'number',
        label: 'Double Jump Window (s)',
        default: 0.3,
        min: 0,
        max: 2,
      },
      landingBuffer: {
        type: 'number',
        label: 'Landing Buffer (s)',
        default: 0.1,
        min: 0,
        max: 1,
      },
      jumpScoreMultiplier: {
        type: 'number',
        label: 'Jump Score Multiplier',
        default: 1,
        min: 0,
        max: 10,
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'jump:start',
        'jump:peak',
        'jump:land',
        'jump:release',
      ],
      consumes: [
        'gravity:landed',
        'jump:release',
        'input:touch:release',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const groundY = this.params.groundY ?? 0.8;
    this.canvasWidth = engine.getCanvas().width;
    this.canvasHeight = engine.getCanvas().height;
    this.y = groundY;
    this.grounded = true;

    // Check if Gravity module is present for integrated physics
    const gravityModules = engine.getModulesByType('Gravity');
    if (gravityModules.length > 0) {
      this.gravity = gravityModules[0] as unknown as Gravity;
      const pixelY = groundY * this.canvasHeight;
      this.gravity.addObject('player', {
        x: engine.getCanvas().width / 2,
        y: pixelY,
        floorY: pixelY,
        airborne: false,
      });

      // Listen for Gravity landing events to sync state
      this.on('gravity:landed', (data?: any) => {
        if (data?.id === 'player') {
          this.y = data.y / this.canvasHeight;
          this.velocityY = 0;
          this.grounded = true;
          this.peakReached = false;
          this.emit('jump:land', { y: this.y });
        }
      });
    }

    const trigger = this.params.triggerEvent ?? 'touch:tap';
    this.on(trigger, () => {
      this.triggerJump();
    });

    // Variable jump height: release during ascent cuts the jump short
    // Skip if justJumped (same frame as triggerJump — tap produces both tap and release)
    this.on('jump:release', () => {
      if (this.justJumped) return;
      if (!this.grounded && this.velocityY < 0) {
        this.velocityY *= 0.5;
        if (this.gravity) {
          const obj = this.gravity.getObject('player');
          if (obj && obj.velocityY < 0) {
            this.gravity.addObject('player', { ...obj, velocityY: obj.velocityY * 0.5 });
          }
        }
      }
    });

    // Map touch release to jump release for tap-based jumping
    this.on('input:touch:release', () => {
      if (!this.grounded) {
        this.emit('jump:release');
      }
    });
  }

  triggerJump(): void {
    if (!this.grounded) return;

    const jumpForce = this.params.jumpForce ?? 500;
    this.grounded = false;
    this.peakReached = false;
    this.justJumped = true;

    if (this.gravity) {
      // Delegate to Gravity module: set upward velocity in px/s
      const obj = this.gravity.getObject('player');
      if (obj) {
        this.gravity.addObject('player', {
          ...obj,
          velocityY: -jumpForce,
          airborne: true,
        });
      }
      this.emit('jump:start', { id: 'player', y: this.y });
    } else {
      // Standalone mode: internal fractional physics
      this.velocityY = -jumpForce / 1000;
      this.emit('jump:start', { id: 'player', y: this.y });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    this.justJumped = false;
    if (this.grounded) return;

    if (this.gravity) {
      // Gravity handles physics — just read position back
      const obj = this.gravity.getObject('player');
      if (obj) {
        this.y = obj.y / this.canvasHeight;

        // Detect peak (velocity changed from negative to positive)
        if (!this.peakReached && obj.velocityY >= 0) {
          this.peakReached = true;
          this.emit('jump:peak', { y: this.y });
        }
      }
      return;
    }

    // Standalone mode: internal fractional physics
    const gravity = (this.params.gravity ?? 980) / 1000;
    const groundY = this.params.groundY ?? 0.8;

    this.velocityY += gravity * (dt / 1000);
    this.y += this.velocityY * (dt / 1000);

    if (!this.peakReached && this.velocityY >= 0) {
      this.peakReached = true;
      this.emit('jump:peak', { y: this.y });
    }

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

    if (this.gravity) {
      const pixelY = groundY * this.canvasHeight;
      const obj = this.gravity.getObject('player');
      this.gravity.addObject('player', {
        x: obj?.x ?? this.canvasWidth / 2,
        y: pixelY,
        floorY: pixelY,
        airborne: false,
        velocityY: 0,
      });
    }
  }
}
