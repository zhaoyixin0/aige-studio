import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface GameResults {
  stats: Record<string, number>;
  starRating: number;
  actions: string[];
}

export class ResultScreen extends BaseModule {
  readonly type = 'ResultScreen';

  private visible = false;
  private stats: Record<string, number> = {};

  getSchema(): ModuleSchema {
    return {
      show: {
        type: 'enum[]',
        label: 'Display Stats',
        options: ['score', 'combo_max', 'accuracy', 'time'],
        default: ['score'],
      },
      rating: {
        type: 'object',
        label: 'Star Rating Thresholds',
        default: { '3star': 500, '2star': 300, '1star': 100 },
      },
      actions: {
        type: 'enum[]',
        label: 'Actions',
        options: ['retry', 'share', 'home'],
        default: ['retry', 'share'],
      },
    };
  }

  getDependencies() { return { requires: ['GameFlow'], optional: ['Scorer', 'Timer'] }; }

  getContracts(): ModuleContracts {
    return {
      consumes: [
        'gameflow:state',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.gameflowPaused = false;

    this.on('gameflow:state', (data: any) => {
      if (data?.state === 'finished') {
        this.visible = true;
        this.collectStats();
      }
    });
  }

  private collectStats(): void {
    if (!this.engine) return;

    const showFields: string[] = (this.params.show ?? ['score']) as string[];

    for (const field of showFields) {
      switch (field) {
        case 'score': {
          const scorers = this.engine.getModulesByType('Scorer');
          if (scorers.length > 0) {
            const scorer = scorers[0] as any;
            this.stats.score = scorer.getScore?.() ?? 0;
          }
          break;
        }
        case 'combo_max': {
          // combo_max would be tracked externally; store 0 as fallback
          this.stats.combo_max = 0;
          break;
        }
        case 'time': {
          const timers = this.engine.getModulesByType('Timer');
          if (timers.length > 0) {
            const timer = timers[0] as any;
            this.stats.time = timer.getElapsed?.() ?? 0;
          }
          break;
        }
        case 'accuracy': {
          this.stats.accuracy = 0;
          break;
        }
      }
    }
  }

  private computeStarRating(): number {
    const score = this.stats.score ?? 0;
    const rating = (this.params.rating ?? { '3star': 500, '2star': 300, '1star': 100 }) as Record<string, number>;

    if (score >= rating['3star']) return 3;
    if (score >= rating['2star']) return 2;
    if (score >= rating['1star']) return 1;
    return 0;
  }

  update(_dt: number): void {
    // ResultScreen is static once visible, nothing to update per frame.
    void _dt;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getResults(): GameResults {
    return {
      stats: { ...this.stats },
      starRating: this.computeStarRating(),
      actions: [...((this.params.actions ?? ['retry', 'share']) as string[])],
    };
  }

  reset(): void {
    this.visible = false;
    this.stats = {};
  }
}
