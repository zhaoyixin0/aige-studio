import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface HudState {
  score: number;
  timer: { remaining: number; elapsed: number };
  lives: number;
  combo: { count: number; fadeTimer: number };
}

export class UIOverlay extends BaseModule {
  readonly type = 'UIOverlay';

  private hudState: HudState = {
    score: 0,
    timer: { remaining: 0, elapsed: 0 },
    lives: 0,
    combo: { count: 0, fadeTimer: 0 },
  };

  /** Duration in ms for the combo popup to remain visible */
  private static readonly COMBO_FADE_DURATION = 1500;

  getSchema(): ModuleSchema {
    return {
      elements: {
        type: 'object',
        label: 'HUD元素',
        default: [],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('scorer:update', (data: any) => {
      this.hudState.score = data.score ?? 0;
    });

    this.on('timer:tick', (data: any) => {
      this.hudState.timer = {
        remaining: data.remaining ?? 0,
        elapsed: data.elapsed ?? 0,
      };
    });

    this.on('lives:change', (data: any) => {
      this.hudState.lives = data.current ?? 0;
    });

    this.on('scorer:combo:*', (data: any) => {
      const combo = typeof data === 'number' ? data : data?.combo ?? 0;
      this.hudState.combo = {
        count: combo,
        fadeTimer: UIOverlay.COMBO_FADE_DURATION,
      };
    });
  }

  update(dt: number): void {
    // Advance combo popup fade timer
    if (this.hudState.combo.fadeTimer > 0) {
      this.hudState.combo.fadeTimer = Math.max(
        0,
        this.hudState.combo.fadeTimer - dt,
      );
    }
  }

  getHudState(): HudState {
    return { ...this.hudState };
  }

  reset(): void {
    this.hudState = {
      score: 0,
      timer: { remaining: 0, elapsed: 0 },
      lives: 0,
      combo: { count: 0, fadeTimer: 0 },
    };
  }
}
