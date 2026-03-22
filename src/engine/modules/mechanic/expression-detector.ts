import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class ExpressionDetector extends BaseModule {
  readonly type = 'ExpressionDetector';

  private lastDetectTime = -Infinity;

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

    this.on('face:*', (data?: any) => {
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
      this.emit('expression:detected', {
        expression: expressionType,
        confidence,
      });
    }
  }

  private getConfidence(expressionType: string, data: any): number {
    switch (expressionType) {
      case 'smile':
        return data.smile ?? data.confidence ?? 0;
      case 'surprise':
        return data.eyebrowRaise ?? data.confidence ?? 0;
      case 'wink':
        return data.blink ?? data.confidence ?? 0;
      case 'open-mouth':
        return data.mouthOpen ?? data.confidence ?? 0;
      default:
        return data.confidence ?? 0;
    }
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.lastDetectTime = -Infinity;
  }
}
