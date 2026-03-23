import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class BeatMap extends BaseModule {
  readonly type = 'BeatMap';

  private elapsed = 0;
  private beatIndex = 0;
  private beats: number[] = [];
  private pendingInput = false;
  private pendingInputTime = 0;
  private started = false;

  getSchema(): ModuleSchema {
    return {
      bpm: {
        type: 'range',
        label: 'BPM',
        default: 120,
        min: 60,
        max: 200,
        step: 1,
      },
      tolerance: {
        type: 'range',
        label: 'Tolerance (ms)',
        default: 200,
        min: 50,
        max: 500,
        step: 10,
        unit: 'ms',
      },
      beats: {
        type: 'object',
        label: 'Beat Timestamps',
        default: [],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('input:touch:tap', () => this.onPlayerInput());
    this.on('input:face:*', () => this.onPlayerInput());
  }

  start(): void {
    this.elapsed = 0;
    this.beatIndex = 0;
    this.started = true;
    this.pendingInput = false;

    // Generate beats from BPM if no explicit beats provided
    const explicitBeats: number[] = this.params.beats ?? [];
    if (explicitBeats.length > 0) {
      this.beats = [...explicitBeats];
    } else {
      this.beats = this.generateBeatsFromBPM();
    }
  }

  private generateBeatsFromBPM(): number[] {
    const bpm = this.params.bpm ?? 120;
    const interval = 60000 / bpm; // ms per beat
    const totalBeats = 32; // generate 32 beats
    const result: number[] = [];
    for (let i = 1; i <= totalBeats; i++) {
      result.push(i * interval);
    }
    return result;
  }

  private onPlayerInput(): void {
    if (!this.started) return;

    this.pendingInput = true;
    this.pendingInputTime = this.elapsed;
  }

  update(dt: number): void {
    if (!this.started) return;

    this.elapsed += dt;

    const tolerance = this.params.tolerance ?? 200;

    // Check if player input matches any beat
    if (this.pendingInput) {
      this.pendingInput = false;
      const inputTime = this.pendingInputTime;

      let matched = false;
      for (let i = this.beatIndex; i < this.beats.length; i++) {
        const beatTime = this.beats[i];
        const diff = Math.abs(inputTime - beatTime);

        if (diff <= tolerance) {
          matched = true;
          this.emit('beat:hit', {
            beatIndex: i,
            beatTime,
            inputTime,
            accuracy: 1 - diff / tolerance,
          });
          // Advance past this beat so it can't be hit again
          if (i >= this.beatIndex) {
            this.beatIndex = i + 1;
          }
          break;
        }
      }

      if (!matched) {
        this.emit('beat:miss', {
          inputTime,
          nearestBeat: this.beats[this.beatIndex] ?? null,
        });
      }
    }

    // Check for missed beats (past tolerance window with no input)
    while (
      this.beatIndex < this.beats.length &&
      this.elapsed > this.beats[this.beatIndex] + tolerance
    ) {
      this.emit('beat:miss', {
        beatIndex: this.beatIndex,
        beatTime: this.beats[this.beatIndex],
      });
      this.beatIndex++;
    }
  }

  getElapsed(): number {
    return this.elapsed;
  }

  getBeats(): number[] {
    return [...this.beats];
  }

  getCurrentBeatIndex(): number {
    return this.beatIndex;
  }

  isStarted(): boolean {
    return this.started;
  }

  reset(): void {
    this.elapsed = 0;
    this.beatIndex = 0;
    this.beats = [];
    this.pendingInput = false;
    this.pendingInputTime = 0;
    this.started = false;
  }
}
