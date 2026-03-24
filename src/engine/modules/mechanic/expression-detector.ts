import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class ExpressionDetector extends BaseModule {
  readonly type = 'ExpressionDetector';

  private lastDetectTime = -Infinity;
  private matched = false;
  private matchFadeTimer = 0;

  getSchema(): ModuleSchema {
    return {
      expressionType: {
        type: 'select',
        label: 'Expression Type',
        default: 'smile',
        options: ['smile', 'surprise', 'wink', 'open-mouth'],
      },
      threshold: {
        type: 'range',
        label: 'Threshold',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.05,
      },
      cooldown: {
        type: 'range',
        label: 'Cooldown (ms)',
        default: 500,
        min: 0,
        max: 2000,
        step: 50,
        unit: 'ms',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('input:face:*', (data?: any) => {
      this.handleFaceEvent(data);
    });
  }

  private handleFaceEvent(data?: any): void {
    if (!data) return;

    const now = performance.now();
    const cooldown = this.params.cooldown ?? 500;

    if (now - this.lastDetectTime < cooldown) return;

    const expressionType = this.params.expressionType ?? 'smile';
    const threshold = this.params.threshold ?? 0.7;

    const confidence = this.getConfidence(expressionType, data);

    if (confidence >= threshold) {
      this.lastDetectTime = now;
      this.matched = true;
      this.matchFadeTimer = 1500; // ms to show checkmark
      this.emit('expression:detected', {
        expression: expressionType,
        confidence,
      });
    }
  }

  private getConfidence(expressionType: string, data: any): number {
    switch (expressionType) {
      case 'smile':
        return data.value ?? data.confidence ?? 0;
      case 'surprise':
        return data.value ?? data.confidence ?? 0;
      case 'wink':
        // blink events have { left, right } instead of { value }
        return Math.max(data.left ?? 0, data.right ?? 0) || data.confidence || 0;
      case 'open-mouth':
        return data.value ?? data.confidence ?? 0;
      default:
        return data.value ?? data.confidence ?? 0;
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (this.matchFadeTimer > 0) {
      this.matchFadeTimer -= dt;
      if (this.matchFadeTimer <= 0) {
        this.matched = false;
        this.matchFadeTimer = 0;
      }
    }
  }

  getExpressionType(): string {
    return (this.params.expressionType as string) ?? 'smile';
  }

  isMatched(): boolean {
    return this.matched;
  }

  getMatchFadeTimer(): number {
    return this.matchFadeTimer;
  }

  reset(): void {
    this.lastDetectTime = -Infinity;
    this.matched = false;
    this.matchFadeTimer = 0;
  }
}
