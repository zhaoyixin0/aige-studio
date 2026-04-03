import type { ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '@/engine/modules/base-module';
import type { HandTracker } from '@/engine/tracking/hand-tracker';

export class HandInput extends BaseModule {
  readonly type = 'HandInput';

  private tracker: HandTracker | null = null;
  private currentGesture: string | null = null;

  getSchema(): ModuleSchema {
    return {
      gesture: {
        type: 'select',
        label: 'Gesture Filter',
        default: 'any',
        options: ['any', 'open', 'closed', 'thumbsUp', 'peace'],
      },
      confidence: {
        type: 'range',
        label: 'Confidence',
        default: 0.7,
        min: 0.5,
        max: 0.95,
        step: 0.05,
      },
      outputTo: {
        type: 'string',
        label: 'Output To',
        default: 'player',
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'input:hand:move',
        'input:hand:gesture',
      ],
    };
  }

  setTracker(tracker: HandTracker): void {
    this.tracker = tracker;
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.tracker) return;

    const result = this.tracker.getLastResult();
    if (!result || !result.detected) return;

    // Emit hand position
    const canvas = this.engine?.getCanvas();
    const canvasW = canvas?.width ?? 1;
    const canvasH = canvas?.height ?? 1;

    // Mirror X for natural movement
    const x = (1 - result.x) * canvasW;
    const y = result.y * canvasH;

    this.emit('input:hand:move', { x, y });

    // Check gesture
    if (result.gesture && result.gesture !== 'none') {
      const filter: string = (this.params.gesture ?? 'any') as string;
      const matches = filter === 'any' || result.gesture === filter;

      if (matches && result.gesture !== this.currentGesture) {
        this.currentGesture = result.gesture;
        this.emit('input:hand:gesture', { gesture: result.gesture });
      }
    } else {
      this.currentGesture = null;
    }
  }

  reset(): void {
    this.currentGesture = null;
  }

  getPosition(): { x: number; y: number } | null {
    const result = this.tracker?.getLastResult();
    if (!result || !result.detected) return null;
    const canvas = this.engine?.getCanvas();
    const canvasW = canvas?.width ?? 1;
    const canvasH = canvas?.height ?? 1;
    return {
      x: (1 - result.x) * canvasW,
      y: result.y * canvasH,
    };
  }

  getGesture(): string | null {
    return this.currentGesture;
  }
}
