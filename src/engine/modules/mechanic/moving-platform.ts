import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface PlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
  pattern: 'horizontal' | 'vertical' | 'circular';
  speed: number;
  range: number;
}

interface PlatformState {
  def: PlatformDef;
  currentX: number;
  currentY: number;
  progress: number;
  direction: 1 | -1;
}

export class MovingPlatform extends BaseModule {
  readonly type = 'MovingPlatform';

  private states: PlatformState[] = [];

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object',
        label: 'Platforms',
        default: [],
      },
      layer: {
        type: 'string',
        label: 'Layer',
        default: 'platforms',
      },
      asset: {
        type: 'asset',
        label: 'Asset',
        default: '',
      },
      tileMode: {
        type: 'select',
        label: 'Tile Mode',
        default: 'stretch',
        options: ['stretch', 'repeat'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.buildStates();
  }

  private buildStates(): void {
    const raw = this.params.platforms;
    const defs: PlatformDef[] = Array.isArray(raw) ? raw : [];
    this.states = defs.map((def) => ({
      def: { ...def },
      currentX: def.x,
      currentY: def.y,
      progress: 0,
      direction: 1 as 1 | -1,
    }));
  }

  update(dt: number): void {
    const dtSec = dt / 1000;

    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];
      const { def } = state;

      switch (def.pattern) {
        case 'horizontal': {
          const offset = def.speed * dtSec * state.direction;
          state.currentX += offset;
          const displacement = state.currentX - def.x;
          if (Math.abs(displacement) >= def.range) {
            // Clamp to range boundary and reverse
            state.currentX = def.x + def.range * state.direction;
            state.direction = (state.direction * -1) as 1 | -1;
          }
          break;
        }
        case 'vertical': {
          const offset = def.speed * dtSec * state.direction;
          state.currentY += offset;
          const displacement = state.currentY - def.y;
          if (Math.abs(displacement) >= def.range) {
            state.currentY = def.y + def.range * state.direction;
            state.direction = (state.direction * -1) as 1 | -1;
          }
          break;
        }
        case 'circular': {
          state.progress += def.speed * dtSec;
          state.currentX = def.x + Math.cos(state.progress) * def.range;
          state.currentY = def.y + Math.sin(state.progress) * def.range;
          break;
        }
      }

      this.emit('platform:move', {
        id: i,
        x: state.currentX,
        y: state.currentY,
        width: def.width,
        height: def.height,
      });
    }
  }

  getPlatformPositions(): { x: number; y: number; width: number; height: number }[] {
    return this.states.map((s) => ({
      x: s.currentX,
      y: s.currentY,
      width: s.def.width,
      height: s.def.height,
    }));
  }

  checkCollision(px: number, py: number): boolean {
    for (const state of this.states) {
      const { currentX, currentY, def } = state;
      if (
        px >= currentX &&
        px <= currentX + def.width &&
        py >= currentY &&
        py <= currentY + def.height
      ) {
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.buildStates();
  }
}
