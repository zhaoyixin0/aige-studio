import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface HazardDef {
  x: number;
  y: number;
  width: number;
  height: number;
  pattern: 'static' | 'oscillate' | 'rotate';
}

interface HazardState {
  def: HazardDef;
  currentX: number;
  currentY: number;
  elapsed: number;
}

export class Hazard extends BaseModule {
  readonly type = 'Hazard';

  private states: HazardState[] = [];

  getSchema(): ModuleSchema {
    return {
      hazards: {
        type: 'object',
        label: 'Hazards',
        default: [],
      },
      damage: {
        type: 'range',
        label: 'Damage',
        default: 1,
        min: 1,
        max: 10,
        step: 1,
      },
      damageEvent: {
        type: 'string',
        label: 'Damage Event',
        default: 'collision:damage',
      },
      layer: {
        type: 'string',
        label: 'Layer',
        default: 'hazards',
      },
      asset: {
        type: 'asset',
        label: 'Asset',
        default: '',
      },
      oscillateSpeed: {
        type: 'range',
        label: 'Oscillate Speed',
        default: 100,
        min: 0,
        max: 500,
        step: 1,
      },
      oscillateRange: {
        type: 'range',
        label: 'Oscillate Range',
        default: 100,
        min: 0,
        max: 300,
        step: 1,
      },
    };
  }

  getContracts(): ModuleContracts {
    const damageEvent: string = (this.params.damageEvent as string) ?? 'collision:damage';
    return {
      emits: [damageEvent],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.buildStates();
  }

  private buildStates(): void {
    const raw = this.params.hazards;
    const defs: HazardDef[] = Array.isArray(raw) ? raw : [];
    this.states = defs.map((def) => ({
      def: { ...def },
      currentX: def.x,
      currentY: def.y,
      elapsed: 0,
    }));
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    const dtSec = dt / 1000;
    const speed = (this.params.oscillateSpeed as number) ?? 100;
    const range = (this.params.oscillateRange as number) ?? 100;

    for (const state of this.states) {
      const { def } = state;

      switch (def.pattern) {
        case 'static':
          // No movement
          break;

        case 'oscillate': {
          state.elapsed += dtSec;
          state.currentX = def.x + Math.sin(state.elapsed * (speed / range)) * range;
          break;
        }

        case 'rotate': {
          state.elapsed += dtSec;
          const angle = state.elapsed * (speed / range);
          state.currentX = def.x + Math.cos(angle) * range;
          state.currentY = def.y + Math.sin(angle) * range;
          break;
        }
      }
    }
  }

  getHazardPositions(): { x: number; y: number; width: number; height: number }[] {
    return this.states.map((s) => ({
      x: s.currentX,
      y: s.currentY,
      width: s.def.width,
      height: s.def.height,
    }));
  }

  checkCollision(px: number, py: number, playerRadius = 0): boolean {
    for (const state of this.states) {
      const { currentX, currentY, def } = state;
      // Skip hazards with invalid dimensions
      if (def.width <= 0 || def.height <= 0) continue;
      // Expand hazard rect by playerRadius for circle-rect collision
      if (
        px + playerRadius >= currentX &&
        px - playerRadius <= currentX + def.width &&
        py + playerRadius >= currentY &&
        py - playerRadius <= currentY + def.height
      ) {
        this.emit((this.params.damageEvent as string) ?? 'collision:damage', {
          damage: (this.params.damage as number) ?? 1,
          x: px,
          y: py,
        });
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.buildStates();
  }
}
