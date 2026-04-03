import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface ProjectileInstance {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  damage: number;
  elapsed: number;
  active: boolean;
}

export class Projectile extends BaseModule {
  readonly type = 'Projectile';

  private projectiles: ProjectileInstance[] = [];
  private fireTimer = 0;
  private aimDirection = { dx: 0, dy: -1 };
  private sourcePosition = { x: 0, y: 0 };
  private nextId = 0;

  getSchema(): ModuleSchema {
    return {
      speed: {
        type: 'range',
        label: 'Speed (px/s)',
        default: 600,
        min: 100,
        max: 2000,
      },
      damage: {
        type: 'range',
        label: 'Damage',
        default: 10,
        min: 1,
        max: 100,
      },
      lifetime: {
        type: 'range',
        label: 'Lifetime',
        default: 3000,
        min: 500,
        max: 10000,
        unit: 'ms',
      },
      fireRate: {
        type: 'range',
        label: 'Fire Rate',
        default: 200,
        min: 50,
        max: 2000,
        unit: 'ms',
      },
      fireEvent: {
        type: 'string',
        label: 'Fire Event',
        default: 'input:touch:tap',
      },
      layer: {
        type: 'string',
        label: 'Layer',
        default: 'projectiles',
      },
      piercing: {
        type: 'boolean',
        label: 'Piercing',
        default: false,
      },
      maxProjectiles: {
        type: 'range',
        label: 'Max Projectiles',
        default: 50,
        min: 5,
        max: 200,
      },
      collisionRadius: {
        type: 'range',
        label: 'Collision Radius',
        default: 8,
        min: 2,
        max: 50,
      },
      asset: { type: 'string', label: 'Projectile Asset Key', default: 'bullet' },
      autoFire: { type: 'boolean', label: 'Auto Fire', default: false },
      clipCapacity: {
        type: 'number',
        label: 'Clip Capacity',
        default: 30,
        min: 1,
        max: 200,
      },
      recoil: {
        type: 'number',
        label: 'Recoil',
        default: 0,
        min: 0,
        max: 50,
      },
      burstLimit: {
        type: 'number',
        label: 'Burst Limit',
        default: 1,
        min: 1,
        max: 10,
      },
      fireInterval: {
        type: 'number',
        label: 'Fire Interval (s)',
        default: 0.1,
        min: 0.01,
        max: 5,
      },
    };
  }

  getContracts(): ModuleContracts {
    const layer = (this.params.layer as string) ?? 'projectiles';
    const radius = (this.params.collisionRadius as number) ?? 8;
    const damage = (this.params.damage as number) ?? 10;

    return {
      collisionProvider: {
        layer,
        radius,
        spawnEvent: 'projectile:fire',
        destroyEvent: 'projectile:destroyed',
        getActiveObjects: () =>
          this.projectiles
            .filter((p) => p.active)
            .map((p) => ({ id: p.id, x: p.x, y: p.y })),
      },
      damageSource: {
        amount: damage,
      },
      emits: ['projectile:fire', 'projectile:destroyed'],
      consumes: ['player:move', 'aim:update', 'gameflow:resume', 'gameflow:pause'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const fireEvent = this.params.fireEvent ?? 'input:touch:tap';
    this.on(fireEvent, () => this.fire());

    this.on('aim:update', (data?: any) => {
      if (data && typeof data.dx === 'number' && typeof data.dy === 'number') {
        this.aimDirection = { dx: data.dx, dy: data.dy };
      }
    });

    this.on('player:move', (data?: any) => {
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        this.sourcePosition = { x: data.x, y: data.y };
      }
    });
  }

  fire(): void {
    if (this.gameflowPaused) return;
    if (this.fireTimer > 0) return;
    if (this.projectiles.length >= (this.params.maxProjectiles ?? 50)) return;

    const { dx, dy } = this.aimDirection;
    const { x, y } = this.sourcePosition;
    const speed = this.params.speed ?? 600;
    const damage = this.params.damage ?? 10;
    const id = `proj-${++this.nextId}`;

    const proj: ProjectileInstance = {
      id,
      x,
      y,
      dx,
      dy,
      speed,
      damage,
      elapsed: 0,
      active: true,
    };

    this.projectiles = [...this.projectiles, proj];
    this.fireTimer = this.params.fireRate ?? 200;

    this.emit('projectile:fire', { id, x, y, dx, dy, speed, damage });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    // Decrement cooldown timer
    if (this.fireTimer > 0) {
      this.fireTimer = Math.max(0, this.fireTimer - dt);
    }

    // Auto-fire: fire every cooldown cycle
    if (this.params.autoFire) {
      this.fire();
    }

    const lifetime = this.params.lifetime ?? 3000;
    const destroyed: string[] = [];

    // Move projectiles and check lifetime
    this.projectiles = this.projectiles.map((p) => {
      if (!p.active) return p;

      const newElapsed = p.elapsed + dt;
      if (newElapsed >= lifetime) {
        destroyed.push(p.id);
        return { ...p, elapsed: newElapsed, active: false };
      }

      const dist = p.speed * (dt / 1000);
      return { ...p, x: p.x + p.dx * dist, y: p.y + p.dy * dist, elapsed: newElapsed };
    });

    for (const id of destroyed) {
      this.emit('projectile:destroyed', { id });
    }

    // Remove inactive projectiles
    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  getActiveProjectiles(): ProjectileInstance[] {
    return this.projectiles.filter((p) => p.active);
  }

  setAimDirection(dx: number, dy: number): void {
    this.aimDirection = { dx, dy };
  }

  setSourcePosition(x: number, y: number): void {
    this.sourcePosition = { x, y };
  }

  reset(): void {
    this.projectiles = [];
    this.fireTimer = 0;
    this.nextId = 0;
  }
}
