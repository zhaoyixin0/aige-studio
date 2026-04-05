import { BaseModule } from '../base-module';
import { Physics2DSystem } from '@/engine/systems/physics2d/physics2d-system';
import type { RigidBody2DConfig, Collider2DConfig, RaycastHit } from '@/engine/systems/physics2d/types';
import type { ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

interface BodyDef {
  readonly entityId: string;
  readonly body: RigidBody2DConfig;
  readonly colliders: readonly Collider2DConfig[];
  readonly x: number;
  readonly y: number;
}

export class Physics2D extends BaseModule {
  readonly type = 'Physics2D';

  private system: Physics2DSystem | null = null;

  getSchema(): ModuleSchema {
    return {
      gravityX: { type: 'number', label: 'Gravity X', default: 0 },
      gravityY: { type: 'number', label: 'Gravity Y', default: 9.81 },
      pixelsPerMeter: { type: 'number', label: 'Pixels per Meter', default: 33.33, min: 1, max: 200 },
      bodies: { type: 'object', label: 'Physics Bodies', default: [] },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['physics2d:contact-begin', 'physics2d:contact-end'],
      consumes: ['gameflow:pause', 'gameflow:resume', 'physics2d:add-body', 'physics2d:remove-body'],
      capabilities: ['physics2d-provider'],
    };
  }

  init(engine: import('@/engine/core/types').GameEngine): void {
    super.init(engine);

    const gx = (this.params.gravityX as number) ?? 0;
    const gy = (this.params.gravityY as number) ?? 9.81;
    const ppm = (this.params.pixelsPerMeter as number) ?? 33.33;

    this.system = new Physics2DSystem(
      { gravityX: gx, gravityY: gy, pixelsPerMeter: ppm, fixedTimeStep: 1 / 60, maxSubSteps: 5 },
      (event, data) => { this.emit(event, data); },
    );

    // Register initial bodies from config
    const bodies = this.params.bodies;
    if (Array.isArray(bodies)) {
      for (const def of bodies) {
        if (this.isValidBodyDef(def)) {
          this.system.addBody(def.entityId, def.body, def.colliders, def.x, def.y);
        }
      }
    }

    // Listen for runtime body management events
    this.on('physics2d:add-body', (data?: unknown) => {
      if (!data || typeof data !== 'object' || !this.system) return;
      const d = data as Record<string, unknown>;
      if (this.isValidBodyDef(d)) {
        this.system.addBody(
          d.entityId as string,
          d.body as RigidBody2DConfig,
          d.colliders as Collider2DConfig[],
          d.x as number,
          d.y as number,
        );
      }
    });

    this.on('physics2d:remove-body', (data?: unknown) => {
      if (!data || typeof data !== 'object' || !this.system) return;
      const d = data as Record<string, unknown>;
      if (typeof d.entityId === 'string') {
        this.system.removeBody(d.entityId);
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused || !this.system) return;
    this.system.update(dt);
  }

  addBody(entityId: string, bodyConfig: RigidBody2DConfig, colliders: readonly Collider2DConfig[], x: number, y: number): void {
    this.system?.addBody(entityId, bodyConfig, colliders, x, y);
  }

  removeBody(entityId: string): void {
    this.system?.removeBody(entityId);
  }

  getBodyPosition(entityId: string): { x: number; y: number } | null {
    return this.system?.getPosition(entityId) ?? null;
  }

  getBodyVelocity(entityId: string): { x: number; y: number } | null {
    return this.system?.getVelocity(entityId) ?? null;
  }

  setBodyVelocity(entityId: string, vx: number, vy: number): void {
    this.system?.setVelocity(entityId, vx, vy);
  }

  applyImpulse(entityId: string, ix: number, iy: number): void {
    this.system?.applyImpulse(entityId, ix, iy);
  }

  raycast(fromX: number, fromY: number, toX: number, toY: number): RaycastHit | null {
    return this.system?.raycast(fromX, fromY, toX, toY) ?? null;
  }

  destroy(): void {
    this.system?.destroy();
    this.system = null;
    super.destroy();
  }

  private isValidBodyDef(d: unknown): d is BodyDef {
    if (!d || typeof d !== 'object') return false;
    const obj = d as Record<string, unknown>;
    return (
      typeof obj.entityId === 'string' &&
      obj.body != null && typeof obj.body === 'object' &&
      Array.isArray(obj.colliders) &&
      typeof obj.x === 'number' &&
      typeof obj.y === 'number'
    );
  }
}
