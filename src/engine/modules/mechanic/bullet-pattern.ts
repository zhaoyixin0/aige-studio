import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

type Direction = { dx: number; dy: number };

interface BurstQueueEntry {
  baseDx: number;
  baseDy: number;
  remaining: number;
}

function rotateVec(dx: number, dy: number, angleDeg: number): Direction {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    dx: dx * cos - dy * sin,
    dy: dx * sin + dy * cos,
  };
}

function toAngle(dx: number, dy: number): number {
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function fromAngle(deg: number): Direction {
  const rad = (deg * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
}

export class BulletPattern extends BaseModule {
  readonly type = 'BulletPattern';

  private spiralAngle = 0;
  private burstQueue: BurstQueueEntry | null = null;
  private burstTimer = 0;

  getSchema(): ModuleSchema {
    return {
      pattern: {
        type: 'select',
        label: 'Pattern',
        default: 'single',
        options: ['single', 'spread', 'spiral', 'burst', 'random'],
      },
      bulletCount: {
        type: 'range',
        label: 'Bullet Count',
        default: 1,
        min: 1,
        max: 36,
      },
      spreadAngle: {
        type: 'range',
        label: 'Spread Angle',
        default: 30,
        min: 5,
        max: 360,
        unit: '°',
      },
      spiralSpeed: {
        type: 'range',
        label: 'Spiral Speed',
        default: 90,
        min: 10,
        max: 360,
        unit: '°/s',
      },
      burstDelay: {
        type: 'range',
        label: 'Burst Delay',
        default: 50,
        min: 10,
        max: 500,
        unit: 'ms',
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['bulletpattern:fire'],
      consumes: ['projectile:fire'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('projectile:fire', (data?: any) => {
      const dx = data?.dx ?? 0;
      const dy = data?.dy ?? -1;
      this.handleFire(dx, dy);
    });
  }

  private handleFire(baseDx: number, baseDy: number): void {
    const pattern = this.params.pattern ?? 'single';

    if (pattern === 'burst') {
      const count = this.params.bulletCount ?? 1;
      // Fire first bullet immediately
      this.emit('bulletpattern:fire', { directions: this.calculateDirections(baseDx, baseDy) });
      if (count > 1) {
        this.burstQueue = { baseDx, baseDy, remaining: count - 1 };
        this.burstTimer = this.params.burstDelay ?? 50;
      }
      return;
    }

    const directions = this.calculateDirections(baseDx, baseDy);
    this.emit('bulletpattern:fire', { directions });
  }

  calculateDirections(baseDx: number, baseDy: number): Direction[] {
    const pattern = this.params.pattern ?? 'single';
    const count = this.params.bulletCount ?? 1;
    const spreadAngle = this.params.spreadAngle ?? 30;

    switch (pattern) {
      case 'single':
        return [{ dx: baseDx, dy: baseDy }];

      case 'spread': {
        if (count === 1) return [{ dx: baseDx, dy: baseDy }];
        const step = spreadAngle / (count - 1);
        const startAngle = -spreadAngle / 2;
        const results: Direction[] = [];
        for (let i = 0; i < count; i++) {
          results.push(rotateVec(baseDx, baseDy, startAngle + step * i));
        }
        return results;
      }

      case 'spiral': {
        const rotated = rotateVec(baseDx, baseDy, this.spiralAngle);
        return [rotated];
      }

      case 'burst':
        // Single direction per call (burst managed by queue)
        return [{ dx: baseDx, dy: baseDy }];

      case 'random': {
        const results: Direction[] = [];
        const baseAngle = toAngle(baseDx, baseDy);
        for (let i = 0; i < count; i++) {
          const offset = (Math.random() - 0.5) * spreadAngle;
          results.push(fromAngle(baseAngle + offset));
        }
        return results;
      }

      default:
        return [{ dx: baseDx, dy: baseDy }];
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const pattern = this.params.pattern ?? 'single';

    // Advance spiral angle
    if (pattern === 'spiral') {
      const spiralSpeed = this.params.spiralSpeed ?? 90;
      this.spiralAngle += spiralSpeed * (dt / 1000);
    }

    // Process burst queue
    if (this.burstQueue && this.burstQueue.remaining > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        const { baseDx, baseDy } = this.burstQueue;
        this.emit('bulletpattern:fire', { directions: [{ dx: baseDx, dy: baseDy }] });
        this.burstQueue = { ...this.burstQueue, remaining: this.burstQueue.remaining - 1 };
        this.burstTimer = this.params.burstDelay ?? 50;
      }
    }
  }

  reset(): void {
    this.spiralAngle = 0;
    this.burstQueue = null;
    this.burstTimer = 0;
  }
}
