import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface ActivePowerUp {
  type: string;
  multiplier?: number;
  duration: number;
  remaining: number;
}

export class PowerUp extends BaseModule {
  readonly type = 'PowerUp';

  private activePowerUps: ActivePowerUp[] = [];

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    return {
      emits: ['powerup:activate', 'powerup:expire'],
      consumes: ['collision:hit'],
    };
  }

  getSchema(): ModuleSchema {
    return {
      powerUpTypes: {
        type: 'object',
        label: 'Power-Up Types',
        default: [
          { type: 'speed', multiplier: 2, duration: 5000 },
          { type: 'shield', duration: 3000 },
        ],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('collision:hit', (data?: any) => {
      this.handleCollision(data);
    });
  }

  private handleCollision(data?: any): void {
    if (!data?.powerUpType) return;

    const types: Array<{ type: string; multiplier?: number; duration: number }> =
      this.params.powerUpTypes ?? [];

    const definition = types.find((t) => t.type === data.powerUpType);
    if (!definition) return;

    this.activate(definition.type, definition.duration, definition.multiplier);
  }

  activate(type: string, duration: number, multiplier?: number): void {
    // Validate duration
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return;

    // Remove existing of same type
    this.activePowerUps = this.activePowerUps.filter((p) => p.type !== type);

    const powerUp: ActivePowerUp = {
      type,
      multiplier,
      duration,
      remaining: duration,
    };

    this.activePowerUps.push(powerUp);

    this.emit('powerup:activate', {
      type,
      duration,
      multiplier,
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    const expired: ActivePowerUp[] = [];

    for (const pu of this.activePowerUps) {
      pu.remaining -= dt;
      if (pu.remaining <= 0) {
        expired.push(pu);
      }
    }

    for (const pu of expired) {
      this.activePowerUps = this.activePowerUps.filter((p) => p !== pu);
      this.emit('powerup:expire', { type: pu.type });
    }
  }

  isActive(type: string): boolean {
    return this.activePowerUps.some((p) => p.type === type);
  }

  getActivePowerUps(): ActivePowerUp[] {
    return [...this.activePowerUps];
  }

  reset(): void {
    this.activePowerUps = [];
  }
}
