import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface PlatformRect {
  x: number;
  y: number;
  width: number;
  height: number;
  material: 'normal' | 'ice' | 'sticky';
}

const FRICTION_MAP: Record<string, number> = {
  normal: 0.8,
  ice: 0.1,
  sticky: 1.0,
};

export class StaticPlatform extends BaseModule {
  readonly type = 'StaticPlatform';

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
      friction: {
        type: 'range',
        label: 'Friction',
        default: 0.8,
        min: 0,
        max: 1,
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
  }

  getPlatforms(): PlatformRect[] {
    const platforms = this.params.platforms;
    if (Array.isArray(platforms)) {
      return platforms as PlatformRect[];
    }
    return [];
  }

  checkCollision(
    px: number,
    py: number,
  ): (PlatformRect & { index: number }) | null {
    const platforms = this.getPlatforms();
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (
        px >= p.x &&
        px <= p.x + p.width &&
        py >= p.y &&
        py <= p.y + p.height
      ) {
        this.emit('platform:contact', {
          id: this.id,
          index: i,
          material: p.material,
          x: px,
          y: py,
        });
        return { ...p, index: i };
      }
    }
    return null;
  }

  getFriction(material?: string): number {
    if (material && material in FRICTION_MAP) {
      return FRICTION_MAP[material];
    }
    return this.params.friction ?? 0.8;
  }

  update(_dt: number): void {
    // Static platforms do not update
  }

  reset(): void {
    // No-op for static platforms
  }
}
