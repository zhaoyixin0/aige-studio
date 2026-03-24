import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface CheckpointDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Checkpoint extends BaseModule {
  readonly type = 'Checkpoint';

  private activatedSet = new Set<number>();
  private lastActivated: number | null = null;

  getSchema(): ModuleSchema {
    return {
      checkpoints: {
        type: 'object',
        label: 'Checkpoints',
        default: [],
      },
      layer: {
        type: 'string',
        label: 'Layer',
        default: 'checkpoints',
      },
      asset: {
        type: 'asset',
        label: 'Asset',
        default: '',
      },
      activeAsset: {
        type: 'asset',
        label: 'Active Asset',
        default: '',
      },
    };
  }

  getDependencies() { return { requires: [], optional: ['Lives'] }; }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('lives:zero', () => {
      this.respawn();
    });
  }

  activate(index: number): void {
    if (this.activatedSet.has(index)) return;

    const checkpoints = this.getCheckpoints();
    const cp = checkpoints[index];
    if (!cp) return;

    this.activatedSet.add(index);
    this.lastActivated = index;

    this.emit('checkpoint:activate', {
      id: `checkpoint-${index}`,
      index,
      x: cp.x,
      y: cp.y,
    });
  }

  getRespawnPoint(): { x: number; y: number } | null {
    if (this.lastActivated === null) return null;

    const checkpoints = this.getCheckpoints();
    const cp = checkpoints[this.lastActivated];
    return { x: cp.x, y: cp.y };
  }

  isActivated(index: number): boolean {
    return this.activatedSet.has(index);
  }

  getCheckpoints(): CheckpointDef[] {
    const raw = this.params.checkpoints;
    return Array.isArray(raw) ? raw : [];
  }

  private respawn(): void {
    if (this.lastActivated === null) return;

    const checkpoints = this.getCheckpoints();
    const cp = checkpoints[this.lastActivated];

    this.emit('checkpoint:respawn', {
      id: `checkpoint-${this.lastActivated}`,
      x: cp.x,
      y: cp.y,
    });
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.activatedSet.clear();
    this.lastActivated = null;
  }
}
