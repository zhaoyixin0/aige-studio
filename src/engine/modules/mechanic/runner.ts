import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Runner extends BaseModule {
  readonly type = 'Runner';

  private currentLane = 0;
  private distance = 0;
  private currentSpeed = 0;
  private started = false;

  getContracts(): import('@/engine/core/contracts').ModuleContracts {
    return {
      emits: ['runner:laneChange', 'runner:distance'],
      consumes: ['input:touch:swipe'],
    };
  }

  getSchema(): ModuleSchema {
    return {
      laneCount: {
        type: 'range',
        label: 'Lane Count',
        default: 3,
        min: 2,
        max: 5,
        step: 1,
      },
      speed: {
        type: 'range',
        label: 'Speed',
        default: 300,
        min: 100,
        max: 1000,
        step: 10,
      },
      acceleration: {
        type: 'range',
        label: 'Acceleration',
        default: 10,
        min: 0,
        max: 50,
        step: 1,
      },
      maxSpeed: {
        type: 'range',
        label: 'Max Speed',
        default: 1500,
        min: 100,
        max: 5000,
        step: 50,
      },
      trackWidth: {
        type: 'number',
        label: 'Track Width (px)',
        default: 300,
        min: 100,
        max: 1000,
      },
      steeringSensitivity: {
        type: 'number',
        label: 'Steering Sensitivity',
        default: 1,
        min: 0.1,
        max: 5,
      },
      slideDistance: {
        type: 'number',
        label: 'Slide Distance (px)',
        default: 100,
        min: 10,
        max: 500,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('input:touch:swipe', (data?: any) => {
      this.handleSwipe(data);
    });
  }

  start(): void {
    const laneCount = this.params.laneCount ?? 3;
    this.currentLane = Math.floor(laneCount / 2);
    this.distance = 0;
    this.currentSpeed = this.params.speed ?? 300;
    this.started = true;
  }

  private handleSwipe(data?: any): void {
    if (!this.started) return;

    const laneCount = this.params.laneCount ?? 3;
    const direction = data?.direction as string | undefined;

    let newLane = this.currentLane;

    if (direction === 'left' && this.currentLane > 0) {
      newLane = this.currentLane - 1;
    } else if (direction === 'right' && this.currentLane < laneCount - 1) {
      newLane = this.currentLane + 1;
    }

    if (newLane !== this.currentLane) {
      const prevLane = this.currentLane;
      this.currentLane = newLane;
      this.emit('runner:laneChange', {
        from: prevLane,
        to: newLane,
        laneCount,
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.started) return;

    const acceleration = this.params.acceleration ?? 10;
    const maxSpeed = this.params.maxSpeed ?? 1500;

    // Increase speed over time, clamped to maxSpeed
    this.currentSpeed += acceleration * (dt / 1000);
    if (this.currentSpeed > maxSpeed) {
      this.currentSpeed = maxSpeed;
    }

    // Accumulate distance
    this.distance += this.currentSpeed * (dt / 1000);

    this.emit('runner:distance', {
      distance: this.distance,
      speed: this.currentSpeed,
      lane: this.currentLane,
    });
  }

  getCurrentLane(): number {
    return this.currentLane;
  }

  getDistance(): number {
    return this.distance;
  }

  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  isStarted(): boolean {
    return this.started;
  }

  reset(): void {
    this.currentLane = 0;
    this.distance = 0;
    this.currentSpeed = 0;
    this.started = false;
  }
}
