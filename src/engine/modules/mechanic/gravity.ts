import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface GravityObject {
  id: string;
  x: number;
  y: number;
  velocityY: number;
  floorY: number;
  airborne: boolean;
}

export class Gravity extends BaseModule {
  readonly type = 'Gravity';

  private objects = new Map<string, GravityObject>();
  private enabled = true;

  getSchema(): ModuleSchema {
    return {
      strength: {
        type: 'range',
        label: 'Gravity Strength',
        default: 980,
        min: 200,
        max: 2000,
        step: 10,
      },
      terminalVelocity: {
        type: 'range',
        label: 'Terminal Velocity',
        default: 800,
        min: 100,
        max: 2000,
        step: 10,
      },
      applyTo: {
        type: 'select',
        label: 'Apply To',
        default: 'player',
        options: ['player', 'items', 'all'],
      },
      toggleEvent: {
        type: 'string',
        label: 'Toggle Event',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('jump:start', (data?: any) => {
      if (data?.id) {
        const obj = this.objects.get(data.id);
        if (obj) {
          obj.airborne = true;
        }
      }
    });

    const toggleEvent = this.params.toggleEvent;
    if (toggleEvent) {
      this.on(toggleEvent, () => {
        this.enabled = !this.enabled;
      });
    }
  }

  addObject(
    id: string,
    opts: { x: number; y: number; floorY: number; airborne: boolean; velocityY?: number },
  ): void {
    this.objects.set(id, {
      id,
      x: opts.x,
      y: opts.y,
      velocityY: opts.velocityY ?? 0,
      floorY: opts.floorY,
      airborne: opts.airborne,
    });
  }

  getObject(id: string): GravityObject | undefined {
    return this.objects.get(id);
  }

  removeObject(id: string): void {
    this.objects.delete(id);
  }

  reset(): void {
    this.objects.clear();
    this.enabled = true;
  }

  update(dt: number): void {
    if (!this.enabled) return;

    const strength = this.params.strength ?? 980;
    const terminalVelocity = this.params.terminalVelocity ?? 800;
    const dtSec = dt / 1000;

    for (const obj of this.objects.values()) {
      if (!obj.airborne) continue;

      // Emit falling event on first frame of being airborne
      this.emit('gravity:falling', { id: obj.id });

      // Apply gravity acceleration
      obj.velocityY += strength * dtSec;

      // Cap at terminal velocity
      if (obj.velocityY > terminalVelocity) {
        obj.velocityY = terminalVelocity;
      }

      // Update position
      obj.y += obj.velocityY * dtSec;

      // Check for landing
      if (obj.y >= obj.floorY) {
        obj.y = obj.floorY;
        obj.velocityY = 0;
        obj.airborne = false;
        this.emit('gravity:landed', { id: obj.id, y: obj.y });
      }
    }
  }
}
