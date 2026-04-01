import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export class PlayerMovement extends BaseModule {
  readonly type = 'PlayerMovement';

  private x = 0;
  private y = 0;
  private velocityX = 0;
  private direction: -1 | 0 | 1 = 0;
  private inputActive = false;
  private wasStopped = true;
  private holdTimer = 0;
  private inputLocked = false;
  private touchTarget: { x: number; y: number } | null = null;

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
      defaultY: {
        type: 'range',
        label: 'Default Y (fraction)',
        default: 0.85,
        min: 0,
        max: 1,
        step: 0.05,
      },
      mode: {
        type: 'select',
        label: 'Mode',
        default: 'velocity',
        options: ['velocity', 'follow'],
      },
      followSpeed: {
        type: 'range',
        label: 'Follow Speed (lerp)',
        default: 0.15,
        min: 0.01,
        max: 1,
        step: 0.01,
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      playerPosition: {
        getPosition: () => ({ x: this.x, y: this.y }),
        setPosition: (x, y) => {
          this.x = x;
          this.y = y;
        },
        radius: 32,
      },
      emits: ['player:move'],
      consumes: [
        'input:touch:hold', 'input:touch:release', 'input:touch:position',
        'input:face:move', 'input:hand:move', 'input:body:move',
        'gameflow:resume', 'gameflow:pause',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    // Initialize position to canvas center
    const canvas = engine.getCanvas();
    this.x = canvas.width / 2;
    const defaultY = (this.params.defaultY as number) ?? 0.85;
    this.y = Math.round(defaultY * canvas.height);

    // Continuous position input (follow mode: lerp via touchTarget; velocity mode: direct x)
    const continuousEvent = this.params.continuousEvent as string | undefined;
    if (continuousEvent) {
      this.on(continuousEvent, (data?: any) => {
        if (!data) return;
        const mapped = this.mapEventToCanvas(continuousEvent, data);
        if (!mapped) return;
        if (this.params.mode === 'follow') {
          this.touchTarget = mapped;
        } else {
          this.x = mapped.x;
        }
      });
    } else if (this.params.mode === 'follow') {
      // Fallback: hardcoded touch listener when no continuousEvent configured
      this.on('input:touch:position', (data?: any) => {
        if (data && typeof data.x === 'number' && typeof data.y === 'number') {
          this.touchTarget = { x: data.x, y: data.y };
        }
      });
    }

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

  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    // Follow mode: lerp toward touch position
    if (this.params.mode === 'follow') {
      this.updateFollowMode();
      return;
    }

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
        y: this.y,
        direction: this.direction,
        speed: Math.abs(this.velocityX),
      });
    } else if (!this.wasStopped) {
      this.wasStopped = true;
      this.emit('player:stop', { x: this.x, y: this.y });
    }
  }

  private mapEventToCanvas(
    eventName: string,
    data: any,
  ): { x: number; y: number } | null {
    const canvas = this.engine?.getCanvas();
    const cw = canvas?.width ?? 1080;
    const ch = canvas?.height ?? 1920;

    // Touch/Face/Hand/Body: emit canvas-space pixels — passthrough with clamping
    if (eventName === 'input:touch:position' ||
        eventName === 'input:face:move' ||
        eventName === 'input:hand:move' ||
        eventName === 'input:body:move') {
      if (typeof data.x === 'number') {
        return {
          x: Math.max(0, Math.min(cw, data.x)),
          y: typeof data.y === 'number' ? Math.max(0, Math.min(ch, data.y)) : this.y,
        };
      }
      return null;
    }

    // Device tilt: -1 to 1 → canvas X
    if (typeof data.tiltX === 'number') {
      return {
        x: Math.max(0, Math.min(cw, (data.tiltX + 1) / 2 * cw)),
        y: this.y,
      };
    }

    // Audio frequency: 200-800 Hz → canvas X
    if (typeof data.frequency === 'number') {
      const normalized = Math.max(0, Math.min(1, (data.frequency - 200) / 600));
      return { x: normalized * cw, y: this.y };
    }

    // Unknown: if x present, treat as canvas pixels
    if (typeof data.x === 'number') {
      return {
        x: Math.max(0, Math.min(cw, data.x)),
        y: typeof data.y === 'number' ? Math.max(0, Math.min(ch, data.y)) : this.y,
      };
    }

    return null;
  }

  private updateFollowMode(): void {
    if (!this.touchTarget) return;

    const lerp = (this.params.followSpeed as number) ?? 0.15;
    const prevX = this.x;
    const prevY = this.y;

    this.x += (this.touchTarget.x - this.x) * lerp;
    this.y += (this.touchTarget.y - this.y) * lerp;

    if (Math.abs(this.x - prevX) > 0.01 || Math.abs(this.y - prevY) > 0.01) {
      this.emit('player:move', { x: this.x, y: this.y, direction: 0, speed: 0 });
    }
  }

  getX(): number {
    return this.x;
  }

  getY(): number {
    return this.y;
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
    const canvas = this.engine?.getCanvas();
    this.x = (canvas?.width ?? 1080) / 2;
    const defaultY = (this.params.defaultY as number) ?? 0.85;
    this.y = Math.round(defaultY * (canvas?.height ?? 1920));
    this.velocityX = 0;
    this.direction = 0;
    this.inputActive = false;
    this.wasStopped = true;
    this.holdTimer = 0;
    this.inputLocked = false;
    this.touchTarget = null;
  }
}
