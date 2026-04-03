import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface DetectedPlane {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export class PlaneDetection extends BaseModule {
  readonly type = 'PlaneDetection';

  private planes: DetectedPlane[] = [];
  private scanTimer = 0;
  private planeCounter = 0;

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    return {
      emits: ['plane:detected'],
      consumes: ['camera:frame'],
    };
  }

  getSchema(): ModuleSchema {
    return {
      enabled: {
        type: 'boolean',
        label: 'Enabled',
        default: true,
      },
      sensitivity: {
        type: 'range',
        label: 'Sensitivity',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    // Listen for camera frame data (simulated in web)
    this.on('camera:frame', (data?: any) => {
      if (this.params.enabled) {
        this.processFrame(data);
      }
    });
  }

  private processFrame(data?: any): void {
    if (!data) return;

    const sensitivity = this.params.sensitivity ?? 0.5;

    // Simplified web-based plane detection using brightness thresholding
    const brightness = data.brightness ?? data.averageBrightness ?? 0.5;

    // Higher sensitivity = easier to detect planes
    if (brightness >= 1 - (sensitivity as number)) {
      const plane: DetectedPlane = {
        id: `plane-${++this.planeCounter}`,
        x: data.x ?? 0,
        y: data.y ?? 0,
        width: data.width ?? 1,
        height: data.height ?? 1,
        confidence: brightness * (sensitivity as number),
      };

      this.planes.push(plane);
      this.emit('plane:detected', {
        x: plane.x,
        y: plane.y,
        width: plane.width,
        height: plane.height,
        confidence: plane.confidence,
      });
    }
  }

  /**
   * Simulate a plane detection scan (for web fallback).
   * Called periodically in update to simulate AR detection.
   */
  simulateScan(): void {
    if (!this.params.enabled) return;

    const sensitivity = this.params.sensitivity ?? 0.5;
    const confidence = 0.5 + Math.random() * 0.5;

    if (confidence >= 1 - (sensitivity as number)) {
      const plane: DetectedPlane = {
        id: `plane-${++this.planeCounter}`,
        x: Math.random(),
        y: Math.random(),
        width: 0.3 + Math.random() * 0.5,
        height: 0.2 + Math.random() * 0.3,
        confidence,
      };

      this.planes.push(plane);
      this.emit('plane:detected', {
        x: plane.x,
        y: plane.y,
        width: plane.width,
        height: plane.height,
        confidence: plane.confidence,
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.params.enabled) return;

    // Periodic simulation scan every 2 seconds
    this.scanTimer += dt;
    if (this.scanTimer >= 2000) {
      this.scanTimer -= 2000;
      // Only auto-scan when no camera feed is available
      // In production, camera:frame events would drive detection
    }
  }

  getPlanes(): DetectedPlane[] {
    return this.planes.map((p) => ({ ...p }));
  }

  clearPlanes(): void {
    this.planes = [];
  }

  reset(): void {
    this.planes = [];
    this.scanTimer = 0;
    this.planeCounter = 0;
  }
}
