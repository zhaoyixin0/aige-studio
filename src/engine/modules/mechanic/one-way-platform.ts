import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface OneWayPlatformDef {
  x: number;
  y: number;
  width: number;
}

export interface LandingResult {
  index: number;
  x: number;
  y: number;
}

export class OneWayPlatform extends BaseModule {
  readonly type = 'OneWayPlatform';

  private dropping = false;
  private dropTimer = 0;

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
      dropThroughEvent: {
        type: 'string',
        label: 'Drop-Through Event',
        default: '',
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

    const dropEvent = this.params.dropThroughEvent;
    if (dropEvent) {
      this.on(dropEvent, () => {
        this.dropping = true;
        this.dropTimer = 0;
        this.emit('platform:drop', { id: this.id });
      });
    }
  }

  getPlatforms(): OneWayPlatformDef[] {
    const platforms = this.params.platforms;
    if (Array.isArray(platforms)) {
      return platforms as OneWayPlatformDef[];
    }
    return [];
  }

  isDropping(): boolean {
    return this.dropping;
  }

  checkLanding(
    px: number,
    py: number,
    velocityY: number,
  ): LandingResult | null {
    if (this.dropping || velocityY <= 0) {
      return null;
    }

    const platforms = this.getPlatforms();
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (
        px >= p.x &&
        px <= p.x + p.width &&
        py <= p.y &&
        py + velocityY >= p.y
      ) {
        this.emit('platform:land', { id: this.id, index: i, x: px, y: p.y });
        return { index: i, x: px, y: p.y };
      }
    }

    return null;
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (this.dropping) {
      this.dropTimer += dt;
      if (this.dropTimer >= 250) {
        this.dropping = false;
        this.dropTimer = 0;
      }
    }
  }

  reset(): void {
    this.dropping = false;
    this.dropTimer = 0;
  }
}
