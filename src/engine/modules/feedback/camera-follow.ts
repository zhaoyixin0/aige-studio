import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export type CameraMode = 'center' | 'look-ahead' | 'dead-zone';

export class CameraFollow extends BaseModule {
  readonly type = 'CameraFollow';

  private x = 0;
  private y = 0;
  private targetX = 0;
  private targetY = 0;
  private shaking = false;
  private shakeElapsed = 0;
  private playerDirection = 0;

  getSchema(): ModuleSchema {
    return {
      mode: {
        type: 'select',
        label: 'Follow Mode',
        options: ['center', 'look-ahead', 'dead-zone'],
        default: 'center',
      },
      smoothing: {
        type: 'range',
        label: 'Smoothing',
        min: 0,
        max: 0.99,
        step: 0.01,
        default: 0.1,
      },
      deadZone: {
        type: 'object',
        label: 'Dead Zone',
        default: { width: 100, height: 50 },
      },
      lookAheadDistance: {
        type: 'range',
        label: 'Look-Ahead Distance',
        min: 0,
        max: 200,
        step: 1,
        default: 80,
      },
      bounds: {
        type: 'object',
        label: 'Camera Bounds',
      },
      shakeEvent: {
        type: 'string',
        label: 'Shake Event',
        default: '',
      },
      shakeDuration: {
        type: 'range',
        label: 'Shake Duration',
        min: 50,
        max: 500,
        step: 10,
        unit: 'ms',
        default: 200,
      },
      shakeIntensity: {
        type: 'range',
        label: 'Shake Intensity',
        min: 1,
        max: 20,
        step: 1,
        default: 5,
      },
    };
  }

  getContracts(): ModuleContracts {
    const shakeEvent: string = (this.params.shakeEvent ?? '') as string;
    return {
      emits: [
        'camera:shake',
        'camera:move',
      ],
      consumes: shakeEvent ? ['player:move', shakeEvent] : ['player:move'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('player:move', (data: any) => {
      this.targetX = data?.x ?? this.targetX;
      this.targetY = data?.y ?? this.targetY;
      if (data?.direction !== undefined) {
        this.playerDirection = data.direction;
      }
    });

    const shakeEvent: string = this.params.shakeEvent as string;
    if (shakeEvent) {
      this.on(shakeEvent, () => {
        this.shaking = true;
        this.shakeElapsed = 0;
        this.emit('camera:shake');
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    const mode: CameraMode = (this.params.mode ?? 'center') as CameraMode;
    const smoothing: number = (this.params.smoothing ?? 0.1) as number;
    const t = 1 - smoothing;

    // Compute goal based on mode
    let goalX = this.targetX;
    let goalY = this.targetY;

    if (mode === 'look-ahead') {
      const lookAheadDistance: number = this.params.lookAheadDistance as number;
      goalX = this.targetX + this.playerDirection * lookAheadDistance;
    } else if (mode === 'dead-zone') {
      const dz = (this.params.deadZone ?? { width: 100, height: 50 }) as { width: number; height: number };
      const halfW = dz.width / 2;
      const halfH = dz.height / 2;

      // Only move camera when target is outside the dead zone relative to current camera
      goalX = this.x;
      goalY = this.y;

      const diffX = this.targetX - this.x;
      const diffY = this.targetY - this.y;

      if (diffX > halfW) {
        goalX = this.targetX - halfW;
      } else if (diffX < -halfW) {
        goalX = this.targetX + halfW;
      }

      if (diffY > halfH) {
        goalY = this.targetY - halfH;
      } else if (diffY < -halfH) {
        goalY = this.targetY + halfH;
      }
    }

    // Lerp toward goal
    this.x += (goalX - this.x) * t;
    this.y += (goalY - this.y) * t;

    // Clamp to bounds if set
    const bounds = this.params.bounds as { minX?: number; maxX?: number; minY?: number; maxY?: number } | undefined;
    if (bounds) {
      if (bounds.minX !== undefined && this.x < bounds.minX) this.x = bounds.minX;
      if (bounds.maxX !== undefined && this.x > bounds.maxX) this.x = bounds.maxX;
      if (bounds.minY !== undefined && this.y < bounds.minY) this.y = bounds.minY;
      if (bounds.maxY !== undefined && this.y > bounds.maxY) this.y = bounds.maxY;
    }

    // Handle shake timer
    if (this.shaking) {
      this.shakeElapsed += dt;
      const shakeDuration: number = this.params.shakeDuration as number;
      if (this.shakeElapsed >= shakeDuration) {
        this.shaking = false;
        this.shakeElapsed = 0;
      }
    }

    this.emit('camera:move', {
      x: this.x,
      y: this.y,
      shaking: this.shaking,
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  isShaking(): boolean {
    return this.shaking;
  }

  getShakeOffset(): { x: number; y: number } {
    if (!this.shaking) return { x: 0, y: 0 };
    const intensity: number = this.params.shakeIntensity as number;
    return {
      x: (Math.random() * 2 - 1) * intensity,
      y: (Math.random() * 2 - 1) * intensity,
    };
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.shaking = false;
    this.shakeElapsed = 0;
    this.playerDirection = 0;
  }
}
