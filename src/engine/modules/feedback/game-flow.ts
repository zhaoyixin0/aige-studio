import type { GameEngine, GameModule, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export type GameState = 'ready' | 'countdown' | 'playing' | 'finished';

export class GameFlow extends BaseModule {
  readonly type = 'GameFlow';

  private state: GameState = 'ready';
  private countdownTimer = 0;

  getSchema(): ModuleSchema {
    return {
      countdown: {
        type: 'number',
        label: 'Countdown (s)',
        default: 3,
        min: 0,
        max: 10,
      },
      onFinish: {
        type: 'select',
        label: 'On Finish',
        default: 'show_result',
        options: ['show_result', 'restart', 'none'],
      },
    };
  }

  getDependencies() { return { requires: [], optional: ['Timer', 'Lives'] }; }

  getContracts(): ModuleContracts {
    return {
      emits: [
        'gameflow:state',
        'gameflow:resume',
        'gameflow:pause',
      ],
      consumes: [
        'timer:end',
        'lives:zero',
      ],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.gameflowPaused = false;

    this.on('timer:end', () => {
      if (this.state === 'playing') {
        this.transition('finished');
      }
    });

    this.on('lives:zero', () => {
      if (this.state === 'playing') {
        // If a Checkpoint is active, let it handle respawn instead of ending
        if (this.hasActiveCheckpoint()) return;
        this.transition('finished');
      }
    });
  }

  transition(newState: GameState): void {
    const previous = this.state;
    this.state = newState;

    this.emit('gameflow:state', { state: newState, previous });

    if (newState === 'countdown') {
      const countdownSeconds = this.params.countdown ?? 3;
      if (countdownSeconds <= 0) {
        // Skip directly to playing
        this.transition('playing');
        return;
      }
      this.countdownTimer = countdownSeconds;
    }

    if (newState === 'playing') {
      this.emit('gameflow:resume');
    }

    if (newState === 'finished') {
      this.emit('gameflow:pause');
    }
  }

  update(dt: number): void {
    if (this.state !== 'countdown') return;

    this.countdownTimer -= dt / 1000;

    if (this.countdownTimer <= 0) {
      this.countdownTimer = 0;
      this.transition('playing');
    }
  }

  getState(): GameState {
    return this.state;
  }

  getCountdownRemaining(): number {
    return this.countdownTimer;
  }

  private hasActiveCheckpoint(): boolean {
    if (!this.engine) return false;
    const checkpoints = this.engine.getModulesByType('Checkpoint');
    if (checkpoints.length === 0) return false;
    const cp = checkpoints[0] as GameModule & { getRespawnPoint?(): unknown };
    return typeof cp.getRespawnPoint === 'function' && cp.getRespawnPoint() !== null;
  }

  reset(): void {
    this.state = 'ready';
    this.countdownTimer = 0;
  }
}
