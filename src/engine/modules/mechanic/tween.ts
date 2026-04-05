import { BaseModule } from '../base-module';
import { TweenSystem } from '@/engine/systems/tween/tween-system';
import type { TweenClip, TweenProperty } from '@/engine/systems/tween/types';
import type { ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

const TARGET_PATHS: TweenProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'];

export class Tween extends BaseModule {
  readonly type = 'Tween';

  private system: TweenSystem | null = null;
  private clips: ReadonlyMap<string, TweenClip> = new Map();

  getSchema(): ModuleSchema {
    return {
      clips: {
        type: 'object',
        label: 'Animation Clips',
        fields: {
          duration: { type: 'range', label: 'Duration (s)', min: 0.05, max: 10, step: 0.05, default: 1 },
          easing: { type: 'select', label: 'Easing', options: [
            'Linear', 'QuadIn', 'QuadOut', 'QuadInOut',
            'CubicIn', 'CubicOut', 'CubicInOut',
            'ExpoIn', 'ExpoOut', 'ExpoInOut',
            'SineIn', 'SineOut', 'SineInOut',
            'BounceIn', 'BounceOut', 'BounceInOut',
          ], default: 'SineInOut' },
          loop: { type: 'select', label: 'Loop', options: ['once', 'infinite', '2', '3', '5'], default: 'once' },
          pingPong: { type: 'boolean', label: 'Ping Pong', default: false },
          targetPath: { type: 'select', label: 'Target Property', options: TARGET_PATHS, default: 'y' },
          from: { type: 'number', label: 'From', default: 0 },
          to: { type: 'number', label: 'To', default: 100 },
        },
        default: {},
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['tween:start', 'tween:complete', 'tween:update'],
      consumes: ['gameflow:pause', 'gameflow:resume', 'tween:trigger'],
      capabilities: ['tween-provider'],
    };
  }

  init(engine: import('@/engine/core/types').GameEngine): void {
    super.init(engine);

    this.system = new TweenSystem((event, data) => {
      this.emit(event, data);
    });

    // Parse clips from params — filter out invalid entries
    const rawClips = this.params.clips;
    if (Array.isArray(rawClips)) {
      const clipMap = new Map<string, TweenClip>();
      for (const clip of rawClips) {
        if (
          clip && typeof clip === 'object' &&
          typeof clip.id === 'string' &&
          typeof clip.duration === 'number' && clip.duration > 0 &&
          Array.isArray(clip.tracks) && clip.tracks.length > 0
        ) {
          clipMap.set(clip.id, clip as TweenClip);
        }
      }
      this.clips = clipMap;
    }

    // Listen for tween:trigger events
    this.on('tween:trigger', (data?: unknown) => {
      if (!data || typeof data !== 'object') return;
      const d = data as Record<string, unknown>;
      const clipId = d.clipId as string | undefined;
      const entityId = d.entityId as string | undefined;
      if (clipId && entityId) {
        this.startClip(clipId, entityId);
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused || !this.system) return;
    const results = this.system.update(dt);
    for (const r of results) {
      this.emit('tween:update', { entityId: r.entityId, properties: r.properties });
    }
  }

  startClip(clipId: string, entityId: string): void {
    const clip = this.clips.get(clipId);
    if (!clip || !this.system) return;
    this.system.start(clip, entityId);
  }

  stopClip(entityId: string, clipId: string): void {
    this.system?.stop(entityId, clipId);
  }

  stopAll(entityId: string): void {
    this.system?.stopAll(entityId);
  }

  getActiveCount(): number {
    return this.system?.getActiveCount() ?? 0;
  }

  destroy(): void {
    this.system?.clear();
    this.system = null;
    super.destroy();
  }
}
