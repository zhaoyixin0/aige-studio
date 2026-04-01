import type { ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '@/engine/modules/base-module';
import type { FaceTracker } from '@/engine/tracking/face-tracker';
import { computeCoverLayout } from '@/engine/renderer/camera-layer';

export class FaceInput extends BaseModule {
  readonly type = 'FaceInput';

  private tracker: FaceTracker | null = null;
  private smoothX = 0.5;
  private smoothY = 0.5;
  private videoWidth = 0;
  private videoHeight = 0;

  getSchema(): ModuleSchema {
    return {
      tracking: {
        type: 'select',
        label: 'Tracking',
        default: 'headXY',
        options: ['headXY', 'mouthOpen', 'eyeBlink', 'smile'],
      },
      smoothing: {
        type: 'range',
        label: 'Smoothing',
        default: 0.3,
        min: 0,
        max: 0.95,
        step: 0.05,
      },
      sensitivity: {
        type: 'range',
        label: 'Sensitivity',
        default: 1,
        min: 0.5,
        max: 3,
        step: 0.1,
      },
      outputTo: {
        type: 'string',
        label: 'Output To',
        default: 'player',
      },
      playerSize: {
        type: 'range',
        label: '角色大小',
        default: 64,
        min: 24,
        max: 128,
        step: 4,
        unit: 'px',
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'input:face:move',
        'input:face:mouthOpen',
        'input:face:blink',
        'input:face:smile',
      ],
    };
  }

  setTracker(tracker: FaceTracker): void {
    this.tracker = tracker;
  }

  /** Set actual camera video dimensions for coordinate remapping. */
  setVideoDimensions(width: number, height: number): void {
    this.videoWidth = width;
    this.videoHeight = height;
  }

  /**
   * Remap normalized MediaPipe coordinates (0-1 relative to full video frame)
   * to account for "cover" crop when video aspect ratio differs from canvas.
   *
   * Reuses computeCoverLayout for crop boundaries (single source of truth).
   * Returns remapped coordinates in [0, 1] range representing the visible canvas area.
   */
  private remapForCrop(normalizedX: number, normalizedY: number, canvasW: number, canvasH: number): { x: number; y: number } {
    if (this.videoWidth === 0 || this.videoHeight === 0) {
      return { x: normalizedX, y: normalizedY };
    }

    const { crop } = computeCoverLayout(this.videoWidth, this.videoHeight, canvasW, canvasH);

    const rangeX = crop.endX - crop.startX;
    const rangeY = crop.endY - crop.startY;

    const remappedX = rangeX > 0 ? (normalizedX - crop.startX) / rangeX : normalizedX;
    const remappedY = rangeY > 0 ? (normalizedY - crop.startY) / rangeY : normalizedY;

    return {
      x: Math.max(0, Math.min(1, remappedX)),
      y: Math.max(0, Math.min(1, remappedY)),
    };
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.tracker) return;

    const result = this.tracker.getLastResult();
    if (!result) return;

    const smoothing: number = this.params.smoothing ?? 0.3;
    const sensitivity: number = this.params.sensitivity ?? 1;

    const canvas = this.engine?.getCanvas();
    const canvasW = canvas?.width ?? 1;
    const canvasH = canvas?.height ?? 1;

    // Remap for crop offset before applying sensitivity
    const remapped = this.remapForCrop(result.headX, result.headY, canvasW, canvasH);

    // Apply sensitivity around center (0.5)
    const rawX = 0.5 + (remapped.x - 0.5) * sensitivity;
    const rawY = 0.5 + (remapped.y - 0.5) * sensitivity;

    // Exponential smoothing
    this.smoothX = this.smoothX * smoothing + rawX * (1 - smoothing);
    this.smoothY = this.smoothY * smoothing + rawY * (1 - smoothing);

    // Mirror X for natural movement
    const x = (1 - this.smoothX) * canvasW;
    const y = this.smoothY * canvasH;

    this.emit('input:face:move', {
      x,
      y,
      raw: { headX: result.headX, headY: result.headY },
    });

    // Threshold-based events (> 0.5 triggers)
    if (result.mouthOpen > 0.5) {
      this.emit('input:face:mouthOpen', { value: result.mouthOpen });
    }
    if (result.leftEyeBlink > 0.5 || result.rightEyeBlink > 0.5) {
      this.emit('input:face:blink', {
        left: result.leftEyeBlink,
        right: result.rightEyeBlink,
      });
    }
    if (result.smile > 0.5) {
      this.emit('input:face:smile', { value: result.smile });
    }
  }

  reset(): void {
    this.smoothX = 0.5;
    this.smoothY = 0.5;
  }

  getPosition(): { x: number; y: number } {
    const canvas = this.engine?.getCanvas();
    const canvasW = canvas?.width ?? 1;
    const canvasH = canvas?.height ?? 1;
    return {
      x: (1 - this.smoothX) * canvasW,
      y: this.smoothY * canvasH,
    };
  }
}
