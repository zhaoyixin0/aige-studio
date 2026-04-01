import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

interface AimDirection {
  dx: number;
  dy: number;
}

function normalize(dx: number, dy: number): AimDirection {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { dx: 0, dy: -1 };
  return { dx: dx / len, dy: dy / len };
}

export class Aim extends BaseModule {
  readonly type = 'Aim';

  private aimDx = 0;
  private aimDy = -1;
  protected targetId: string | null = null;

  private playerX = 400;
  private playerY = 300;

  getSchema(): ModuleSchema {
    return {
      mode: {
        type: 'select',
        label: 'Mode',
        default: 'auto',
        options: ['auto', 'manual', 'face', 'hand'],
      },
      autoTargetLayer: {
        type: 'string',
        label: 'Auto Target Layer',
        default: 'enemies',
      },
      autoRange: {
        type: 'range',
        label: 'Auto Range',
        default: 500,
        min: 100,
        max: 2000,
      },
      manualEvent: {
        type: 'string',
        label: 'Manual Event',
        default: 'input:touch:hold',
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['aim:update', 'aim:queryTargets'],
      consumes: ['player:move', 'input:face:move', 'input:hand:move'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('player:move', (data?: any) => {
      if (data && typeof data.x === 'number') {
        this.playerX = data.x;
        this.playerY = data.y;
      }
    });

    const manualEvent = this.params.manualEvent as string;

    if (this.params.mode === 'manual') {
      this.on(manualEvent, (data?: any) => {
        if (!data || typeof data.x !== 'number') return;
        const dir = normalize(data.x - this.playerX, data.y - this.playerY);
        this.aimDx = dir.dx;
        this.aimDy = dir.dy;
      });
    }

    if (this.params.mode === 'face') {
      this.on('input:face:move', (data?: any) => {
        if (!data || typeof data.dx !== 'number') return;
        const dir = normalize(data.dx, data.dy ?? 0);
        this.aimDx = dir.dx;
        this.aimDy = dir.dy;
      });
    }

    if (this.params.mode === 'hand') {
      this.on('input:hand:move', (data?: any) => {
        if (!data || typeof data.x !== 'number') return;
        const dir = normalize(data.x - this.playerX, data.y - this.playerY);
        this.aimDx = dir.dx;
        this.aimDy = dir.dy;
      });
    }
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;

    if (this.params.mode === 'auto') {
      this.updateAutoAim();
    }

    this.emit('aim:update', {
      dx: this.aimDx,
      dy: this.aimDy,
      ...(this.targetId ? { targetId: this.targetId } : {}),
    });
  }

  private updateAutoAim(): void {
    const range = (this.params.autoRange as number) ?? 500;
    const layer = (this.params.autoTargetLayer as string) ?? 'enemies';

    // Query collision objects via event — modules may respond synchronously
    let nearest: { id: string; x: number; y: number } | null = null;
    let nearestDist = Infinity;

    this.engine?.eventBus.emit('aim:queryTargets', {
      layer,
      callback: (targets: Array<{ id: string; x: number; y: number }>) => {
        for (const t of targets) {
          const dx = t.x - this.playerX;
          const dy = t.y - this.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < range && dist < nearestDist) {
            nearestDist = dist;
            nearest = t;
          }
        }
      },
    });

    if (nearest) {
      const t = nearest as { id: string; x: number; y: number };
      const dir = normalize(t.x - this.playerX, t.y - this.playerY);
      this.aimDx = dir.dx;
      this.aimDy = dir.dy;
      this.targetId = t.id;
    } else {
      this.targetId = null;
      // Keep default upward aim when no target found
    }
  }

  getAimDirection(): AimDirection {
    return { dx: this.aimDx, dy: this.aimDy };
  }

  reset(): void {
    this.aimDx = 0;
    this.aimDy = -1;
    this.targetId = null;
  }
}
