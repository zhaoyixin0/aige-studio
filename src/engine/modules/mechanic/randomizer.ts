import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface RandomizerItem {
  asset: string;
  label: string;
  weight: number;
}

export interface RandomizerResult {
  item: RandomizerItem;
  index: number;
}

export class Randomizer extends BaseModule {
  readonly type = 'Randomizer';

  private spinning = false;
  private spinTimer = 0;
  private result: RandomizerResult | null = null;

  getSchema(): ModuleSchema {
    return {
      items: {
        type: 'asset[]',
        label: '候选项',
        default: [],
      },
      animation: {
        type: 'select',
        label: '动画类型',
        options: ['wheel', 'slot', 'card', 'instant'],
        default: 'wheel',
      },
      spinDuration: {
        type: 'range',
        label: '旋转时长',
        min: 1,
        max: 10,
        default: 3,
        unit: '秒',
      },
      trigger: {
        type: 'select',
        label: '触发方式',
        options: ['tap', 'auto', 'mouthOpen'],
        default: 'tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.trigger ?? 'tap';

    if (trigger === 'tap') {
      this.on('input:touch:tap', () => this.spin());
    } else if (trigger === 'mouthOpen') {
      this.on('input:face:mouthOpen', () => this.spin());
    }
  }

  spin(): void {
    if (this.spinning) return;

    const items: RandomizerItem[] = this.params.items ?? [];
    if (items.length === 0) return;

    this.spinning = true;
    this.spinTimer = 0;
    this.result = null;

    this.emit('randomizer:spinning');
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.spinning) return;

    this.spinTimer += dt / 1000; // convert ms to seconds
    const spinDuration = this.params.spinDuration ?? 3;

    if (this.spinTimer >= spinDuration) {
      // Pick a result using weighted random
      this.result = this.pickWeightedRandom();
      this.spinning = false;
      this.spinTimer = 0;

      if (this.result) {
        this.emit('randomizer:result', this.result);
      }
    }
  }

  private pickWeightedRandom(): RandomizerResult | null {
    const items: RandomizerItem[] = this.params.items ?? [];
    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      roll -= items[i].weight ?? 1;
      if (roll <= 0) {
        return { item: items[i], index: i };
      }
    }

    // Fallback to last item
    return { item: items[items.length - 1], index: items.length - 1 };
  }

  getResult(): RandomizerResult | null {
    return this.result;
  }

  isSpinning(): boolean {
    return this.spinning;
  }

  getSpinProgress(): number {
    if (!this.spinning) return 0;
    const duration = this.params.spinDuration ?? 3;
    return Math.min(1, this.spinTimer / duration);
  }

  getItems(): Array<{ asset: string; label?: string; weight: number }> {
    return this.params.items ?? [];
  }

  reset(): void {
    this.spinning = false;
    this.spinTimer = 0;
    this.result = null;
  }
}
