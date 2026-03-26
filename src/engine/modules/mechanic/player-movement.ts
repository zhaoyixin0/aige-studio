import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class PlayerMovement extends BaseModule {
  readonly type = 'PlayerMovement';

  private x = 0;
  private velocityX = 0;
  private direction: -1 | 0 | 1 = 0;
  private inputActive = false;
  private wasStopped = true;
  private holdTimer = 0;
  private inputLocked = false;

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
      holdDuration: {
        type: 'range',
        label: 'Hold Duration (ms)',
        default: 0,
        min: 0,
        max: 1000,
        step: 10,
        unit: 'ms',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    // Touch hold: left half → move left, right half → move right
    this.on('input:touch:hold', (data?: any) => {
      if (this.inputLocked) return;
      if (data?.side === 'left') {
        this.direction = -1;
        this.inputActive = true;
      } else if (data?.side === 'right') {
        this.direction = 1;
        this.inputActive = true;
      }
    });

    // Touch release: stop input
    this.on('input:touch:release', () => {
      this.inputActive = false;
    });

    // Swipe also works for quick direction changes
    this.on('input:touch:swipe', (data?: any) => {
      if (this.inputLocked) return;
      if (data?.direction === 'left') {
        this.direction = -1;
        this.inputActive = true;
      } else if (data?.direction === 'right') {
        this.direction = 1;
        this.inputActive = true;
      }
    });

    // Support custom discrete events (for non-touch inputs like hand gesture)
    const moveLeftEvent = this.params.moveLeftEvent;
    const moveRightEvent = this.params.moveRightEvent;
    const holdDuration = this.params.holdDuration ?? 0;
    if (moveLeftEvent && !moveLeftEvent.startsWith('input:touch:')) {
      this.on(moveLeftEvent, () => {
        if (this.inputLocked) return;
        this.direction = -1;
        this.inputActive = true;
        if (holdDuration > 0) this.holdTimer = holdDuration;
      });
    }
    if (moveRightEvent && !moveRightEvent.startsWith('input:touch:')) {
      this.on(moveRightEvent, () => {
        if (this.inputLocked) return;
        this.direction = 1;
        this.inputActive = true;
        if (holdDuration > 0) this.holdTimer = holdDuration;
      });
    }

    const continuousEvent = this.params.continuousEvent;
    if (continuousEvent) {
      this.on(continuousEvent, (data?: any) => {
        if (!data) return;
        const canvasWidth = this.engine?.getCanvas().width ?? 800;
        if (typeof data.x === 'number') {
          // Position-based input (face/hand: normalized 0-1)
          this.x = data.x * canvasWidth;
        } else if (typeof data.frequency === 'number') {
          // Frequency-based input (audio: pitch maps to x position)
          // Map 200-800 Hz range to canvas width
          const normalized = Math.max(0, Math.min(1, (data.frequency - 200) / 600));
          this.x = normalized * canvasWidth;
        } else if (typeof data.tiltX === 'number') {
          // Tilt-based input (device: -1 to 1)
          this.x = (data.tiltX + 1) / 2 * canvasWidth;
        }
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
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

      // Hold timer: sustain input for holdDuration ms after discrete event
      if (this.holdTimer > 0) {
        this.holdTimer -= dt;
        if (this.holdTimer <= 0) {
          this.holdTimer = 0;
          this.inputActive = false;
        }
      } else {
        // Consume input — one-shot per event, not continuous hold
        this.inputActive = false;
      }
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

  lockInput(): void {
    this.inputLocked = true;
    this.inputActive = false;
  }

  unlockInput(): void {
    this.inputLocked = false;
  }

  applyExternalDelta(dx: number): void {
    this.x += dx;
  }

  reset(): void {
    this.x = 0;
    this.velocityX = 0;
    this.direction = 0;
    this.inputActive = false;
    this.wasStopped = true;
    this.holdTimer = 0;
    this.inputLocked = false;
  }
}
