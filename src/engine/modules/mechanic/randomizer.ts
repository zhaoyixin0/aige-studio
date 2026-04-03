import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface RandomizerItem {
  asset: string;
  label: string;
  weight: number;
}

export interface RandomizerResult {
  item: RandomizerItem;
  index: number;
  prizeMultiplier: number;
}

export type DecelCurve =
  | 'easeOutCubic'
  | 'easeOutQuad'
  | 'easeOutExpo'
  | 'linear';

export class Randomizer extends BaseModule {
  readonly type = 'Randomizer';

  private spinning = false;
  private settling = false;
  private spinTimer = 0;
  private result: RandomizerResult | null = null;
  private autoSpinPending = false;

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
      // ─── SpinWheel params ──────────────────────────────
      sectorCount: {
        type: 'number',
        label: '扇区数量',
        min: 2,
        max: 24,
        default: 8,
      },
      spinSpeed: {
        type: 'range',
        label: '转速',
        min: 120,
        max: 1800,
        default: 720,
        unit: '度/秒',
      },
      settleDuration: {
        type: 'range',
        label: '停稳时长',
        min: 0,
        max: 5,
        step: 0.1,
        default: 1.5,
        unit: '秒',
      },
      pointerWidth: {
        type: 'range',
        label: '指针宽度',
        min: 5,
        max: 60,
        default: 20,
        unit: 'px',
      },
      decelCurve: {
        type: 'select',
        label: '减速曲线',
        options: ['easeOutCubic', 'easeOutQuad', 'easeOutExpo', 'linear'],
        default: 'easeOutCubic',
      },
      prizeMultiplier: {
        type: 'range',
        label: '中奖倍率',
        min: 0.1,
        max: 10,
        step: 0.1,
        default: 1,
      },
      pointerJitter: {
        type: 'range',
        label: '指针震颤',
        min: 0,
        max: 2,
        step: 0.1,
        default: 0.3,
      },
      wheelRadius: {
        type: 'range',
        label: '转盘半径',
        min: 50,
        max: 400,
        default: 150,
        unit: 'px',
      },
      pointerOffset: {
        type: 'range',
        label: '指针偏移',
        min: -50,
        max: 50,
        default: 0,
        unit: 'px',
      },
      showLabels: {
        type: 'boolean',
        label: '显示标签',
        default: true,
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'randomizer:spinning',
        'randomizer:settling',
        'randomizer:result',
      ],
      consumes: [
        'input:touch:tap',
        'input:face:mouthOpen',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.trigger ?? 'tap';

    if (trigger === 'tap') {
      this.on('input:touch:tap', () => this.spin());
    } else if (trigger === 'mouthOpen') {
      this.on('input:face:mouthOpen', () => this.spin());
    } else if (trigger === 'auto') {
      this.on('gameflow:resume', () => this.spin());
    }
  }

  spin(): void {
    if (this.spinning) return;

    const items: RandomizerItem[] = (this.params.items as RandomizerItem[]) ?? [];
    if (items.length === 0) return;

    this.spinning = true;
    this.settling = false;
    this.spinTimer = 0;
    this.result = null;

    this.emit('randomizer:spinning');
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    if (this.spinning) {
      this.spinTimer += dt / 1000; // convert ms to seconds
      const spinDuration = this.params.spinDuration ?? 3;
      const isWheel = this.params.animation === 'wheel';
      const settleDuration = isWheel
        ? (this.params.settleDuration ?? 1.5)
        : 0;
      const totalDuration = (spinDuration as number) + (settleDuration as number);

      // Transition from spinning to settling phase (wheel mode only)
      if (isWheel && !this.settling && this.spinTimer >= (spinDuration as number)) {
        this.settling = true;
        this.emit('randomizer:settling');
      }

      if (this.spinTimer >= totalDuration) {
        this.result = this.pickWeightedRandom();
        this.spinning = false;
        this.settling = false;
        this.spinTimer = 0;

        if (this.result) {
          this.emit('randomizer:result', this.result);

          // Auto mode: re-spin after result
          if ((this.params.trigger ?? 'tap') === 'auto') {
            this.autoSpinPending = true;
          }
        }
      }
    }

    // Deferred auto-spin to avoid re-entry during update
    if (this.autoSpinPending) {
      this.autoSpinPending = false;
      this.spin();
    }
  }

  private pickWeightedRandom(): RandomizerResult | null {
    const items: RandomizerItem[] = (this.params.items as RandomizerItem[]) ?? [];
    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      roll -= items[i].weight ?? 1;
      if (roll <= 0) {
        return {
          item: items[i],
          index: i,
          prizeMultiplier: (this.params.prizeMultiplier as number) ?? 1,
        };
      }
    }

    // Fallback to last item
    return {
      item: items[items.length - 1],
      index: items.length - 1,
      prizeMultiplier: (this.params.prizeMultiplier as number) ?? 1,
    };
  }

  getResult(): RandomizerResult | null {
    return this.result;
  }

  isSpinning(): boolean {
    return this.spinning;
  }

  getSpinProgress(): number {
    if (!this.spinning) return 0;
    const spinDuration = (this.params.spinDuration as number) ?? 3;
    const isWheel = this.params.animation === 'wheel';
    const settleDuration = isWheel
      ? ((this.params.settleDuration as number) ?? 1.5)
      : 0;
    const totalDuration = spinDuration + settleDuration;
    return Math.min(1, this.spinTimer / totalDuration);
  }

  getItems(): Array<{ asset: string; label?: string; weight: number }> {
    return (this.params.items as Array<{ asset: string; label?: string; weight: number }>) ?? [];
  }

  reset(): void {
    this.spinning = false;
    this.settling = false;
    this.spinTimer = 0;
    this.result = null;
    this.autoSpinPending = false;
  }
}
