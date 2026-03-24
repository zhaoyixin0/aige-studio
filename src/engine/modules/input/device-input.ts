import type { ModuleSchema, GameEngine } from '@/engine/core';
import { BaseModule } from '@/engine/modules/base-module';

export class DeviceInput extends BaseModule {
  readonly type = 'DeviceInput';

  private tiltX = 0;
  private tiltY = 0;
  private shakeThreshold = 15;

  // Bound handlers for cleanup
  private handleOrientation: ((e: DeviceOrientationEvent) => void) | null =
    null;
  private handleMotion: ((e: DeviceMotionEvent) => void) | null = null;

  getSchema(): ModuleSchema {
    return {
      sensor: {
        type: 'select',
        label: 'Sensor',
        default: 'gyroscope',
        options: ['gyroscope', 'accelerometer'],
      },
      sensitivity: {
        type: 'range',
        label: 'Sensitivity',
        default: 1,
        min: 0.5,
        max: 3,
        step: 0.1,
      },
      deadzone: {
        type: 'range',
        label: 'Dead Zone',
        default: 0.1,
        min: 0,
        max: 0.3,
        step: 0.01,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.bindDeviceEvents();
  }

  private bindDeviceEvents(): void {
    // Orientation (gyroscope-like tilt)
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      this.handleOrientation = (e: DeviceOrientationEvent) =>
        this.onOrientation(e);
      window.addEventListener('deviceorientation', this.handleOrientation);
    }

    // Motion (accelerometer + shake)
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.handleMotion = (e: DeviceMotionEvent) => this.onMotion(e);
      window.addEventListener('devicemotion', this.handleMotion);
    }
  }

  private unbindDeviceEvents(): void {
    if (typeof window === 'undefined') return;

    if (this.handleOrientation) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
      this.handleOrientation = null;
    }
    if (this.handleMotion) {
      window.removeEventListener('devicemotion', this.handleMotion);
      this.handleMotion = null;
    }
  }

  private onOrientation(e: DeviceOrientationEvent): void {
    const sensitivity: number = this.params.sensitivity ?? 1;
    const deadzone: number = this.params.deadzone ?? 0.1;

    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)
    const rawX = ((e.gamma ?? 0) / 90) * sensitivity;
    const rawY = ((e.beta ?? 0) / 90) * sensitivity;

    // Apply deadzone
    this.tiltX = Math.abs(rawX) > deadzone ? rawX : 0;
    this.tiltY = Math.abs(rawY) > deadzone ? rawY : 0;
  }

  private onMotion(e: DeviceMotionEvent): void {
    const accel = e.accelerationIncludingGravity;
    if (!accel) return;

    const magnitude = Math.sqrt(
      (accel.x ?? 0) ** 2 + (accel.y ?? 0) ** 2 + (accel.z ?? 0) ** 2,
    );

    if (magnitude > this.shakeThreshold) {
      this.emit('input:device:shake', { magnitude });
    }
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
    // Emit tilt every frame when device orientation is available
    if (this.tiltX !== 0 || this.tiltY !== 0) {
      this.emit('input:device:tilt', { x: this.tiltX, y: this.tiltY });
    }
  }

  getTilt(): { x: number; y: number } {
    return { x: this.tiltX, y: this.tiltY };
  }

  destroy(): void {
    this.unbindDeviceEvents();
    super.destroy();
  }
}
