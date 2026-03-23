import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class GestureMatch extends BaseModule {
  readonly type = 'GestureMatch';

  private currentTarget: string | null = null;
  private displayTimer = 0;
  private active = false;
  private matchCount = 0;
  private totalTargets = 0;

  getSchema(): ModuleSchema {
    return {
      targetGestures: {
        type: 'object',
        label: 'Target Gestures',
        default: ['thumbs_up', 'peace', 'fist', 'open_palm'],
      },
      displayTime: {
        type: 'range',
        label: 'Display Time (s)',
        default: 3,
        min: 1,
        max: 10,
        step: 0.5,
        unit: 's',
      },
      matchThreshold: {
        type: 'range',
        label: 'Match Threshold',
        default: 0.8,
        min: 0.5,
        max: 1,
        step: 0.05,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('input:hand:gesture', (data?: any) => {
      this.handleGesture(data);
    });
  }

  start(): void {
    this.active = true;
    this.matchCount = 0;
    const gestures: string[] = this.params.targetGestures ?? [];
    this.totalTargets = gestures.length;
    this.nextTarget();
  }

  private nextTarget(): void {
    const gestures: string[] = this.params.targetGestures ?? [];
    if (gestures.length === 0) return;

    this.currentTarget = gestures[Math.floor(Math.random() * gestures.length)];
    this.displayTimer = 0;

    this.emit('gesture:show', {
      target: this.currentTarget,
      displayTime: this.params.displayTime ?? 3,
    });
  }

  private handleGesture(data?: any): void {
    if (!this.active || !this.currentTarget || !data) return;

    const threshold = this.params.matchThreshold ?? 0.8;
    const gesture = data.gesture as string | undefined;
    const confidence = (data.confidence as number | undefined) ?? 1;

    if (gesture === this.currentTarget && confidence >= threshold) {
      this.matchCount++;
      this.emit('gesture:match', {
        target: this.currentTarget,
        gesture,
        confidence,
      });
      this.nextTarget();
    } else if (gesture && gesture !== this.currentTarget) {
      this.emit('gesture:fail', {
        target: this.currentTarget,
        gesture,
        confidence,
      });
    }
  }

  update(dt: number): void {
    if (!this.active || !this.currentTarget) return;

    const displayTime = (this.params.displayTime ?? 3) * 1000; // s to ms
    this.displayTimer += dt;

    if (this.displayTimer >= displayTime) {
      this.emit('gesture:fail', {
        target: this.currentTarget,
        gesture: null,
        reason: 'timeout',
      });
      this.nextTarget();
    }
  }

  getCurrentTarget(): string | null {
    return this.currentTarget;
  }

  isActive(): boolean {
    return this.active;
  }

  getProgress(): { matched: number; total: number } {
    return { matched: this.matchCount, total: this.totalTargets };
  }

  getTargetGestures(): string[] {
    return (this.params.targetGestures as string[]) ?? [];
  }

  reset(): void {
    this.currentTarget = null;
    this.displayTimer = 0;
    this.active = false;
    this.matchCount = 0;
    this.totalTargets = 0;
  }
}
