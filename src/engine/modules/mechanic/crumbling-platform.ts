import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface CrumbleState {
  active: boolean;
  crumbling: boolean;
  crumbleTimer: number;
  respawnTimer: number;
}

export class CrumblingPlatform extends BaseModule {
  readonly type = 'CrumblingPlatform';

  private states: CrumbleState[] = [];

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object',
        label: 'Platforms',
        default: [],
      },
      delay: {
        type: 'range',
        label: 'Crumble Delay',
        default: 500,
        min: 200,
        max: 2000,
      },
      respawnTime: {
        type: 'range',
        label: 'Respawn Time',
        default: 3,
        min: 0,
        max: 10,
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
      crumbleAsset: {
        type: 'asset',
        label: 'Crumble Asset',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.buildStates();
  }

  private buildStates(): void {
    const raw = this.params.platforms;
    const platforms: unknown[] = Array.isArray(raw) ? raw : [];
    this.states = platforms.map(() => ({
      active: true,
      crumbling: false,
      crumbleTimer: 0,
      respawnTimer: 0,
    }));
  }

  triggerCrumble(index: number): void {
    const state = this.states[index];
    if (state && state.active && !state.crumbling) {
      state.crumbling = true;
      state.crumbleTimer = 0;
    }
  }

  isPlatformActive(index: number): boolean {
    const state = this.states[index];
    return state ? state.active : false;
  }

  getPlatforms(): unknown[] {
    const raw = this.params.platforms;
    return Array.isArray(raw) ? raw : [];
  }

  update(dt: number): void {
    const delay = this.params.delay ?? 500;
    const respawnTime = this.params.respawnTime ?? 3;

    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];

      if (state.crumbling) {
        state.crumbleTimer += dt;
        if (state.crumbleTimer >= delay) {
          state.active = false;
          state.crumbling = false;
          state.respawnTimer = 0;
          this.emit('platform:crumble', {
            id: `crumble-${i}`,
            index: i,
          });
        }
      } else if (!state.active && respawnTime > 0) {
        state.respawnTimer += dt;
        if (state.respawnTimer >= respawnTime * 1000) {
          state.active = true;
          state.respawnTimer = 0;
          this.emit('platform:respawn', {
            id: `crumble-${i}`,
            index: i,
          });
        }
      }
    }
  }

  reset(): void {
    this.buildStates();
  }
}
