import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export class SoundFX extends BaseModule {
  readonly type = 'SoundFX';

  private soundQueue: string[] = [];

  getSchema(): ModuleSchema {
    return {
      events: {
        type: 'object',
        label: '事件→音效映射',
        default: {},
      },
      volume: {
        type: 'range',
        label: 'Volume',
        min: 0,
        max: 1,
        step: 0.1,
        default: 0.8,
      },
      muted: {
        type: 'boolean',
        label: 'Muted',
        default: false,
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      consumes: Object.keys(this.params.events ?? {}),
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.gameflowPaused = false;

    const events: Record<string, string> = this.params.events ?? {};
    for (const [eventName, assetId] of Object.entries(events)) {
      this.on(eventName, () => {
        this.playSound(assetId);
      });
    }
  }

  playSound(assetId: string): void {
    if (this.params.muted) return;
    this.soundQueue.push(assetId);
  }

  update(_dt: number): void {
    // Sound playback is handled externally via getSoundQueue.
    // Nothing to update per frame.
    void _dt;
  }

  /** Returns and clears pending sound requests for the audio system to consume. */
  getSoundQueue(): string[] {
    const queue = [...this.soundQueue];
    this.soundQueue = [];
    return queue;
  }

  reset(): void {
    this.soundQueue = [];
  }
}
