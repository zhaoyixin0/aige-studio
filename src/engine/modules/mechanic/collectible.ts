import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface CollectibleDef {
  x: number;
  y: number;
  value: number;
  type: string;
}

export class Collectible extends BaseModule {
  readonly type = 'Collectible';

  private collected = new Set<number>();
  private elapsed = 0;

  getSchema(): ModuleSchema {
    return {
      items: {
        type: 'object',
        label: 'Items',
        default: [],
      },
      layer: {
        type: 'string',
        label: 'Layer',
        default: 'collectibles',
      },
      asset: {
        type: 'asset',
        label: 'Asset',
        default: '',
      },
      floatAnimation: {
        type: 'boolean',
        label: 'Float Animation',
        default: true,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
  }

  private getItems(): CollectibleDef[] {
    const raw = this.params.items;
    if (Array.isArray(raw)) return raw;
    return [];
  }

  getActiveItems(): CollectibleDef[] {
    return this.getItems().filter((_, i) => !this.collected.has(i));
  }

  pickup(index: number): void {
    if (this.collected.has(index)) return;

    const items = this.getItems();
    if (index < 0 || index >= items.length) return;

    this.collected.add(index);
    const item = items[index];

    this.emit('collectible:pickup', {
      index,
      type: item.type,
      value: item.value,
      x: item.x,
      y: item.y,
    });

    if (this.collected.size === items.length) {
      this.emit('collectible:allCollected');
    }
  }

  checkCollision(px: number, py: number, radius: number): boolean {
    const items = this.getItems();
    let hit = false;

    for (let i = 0; i < items.length; i++) {
      if (this.collected.has(i)) continue;

      const dx = px - items[i].x;
      const dy = py - items[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const threshold = radius + 16;

      if (dist < threshold) {
        this.pickup(i);
        hit = true;
      }
    }

    return hit;
  }

  getItemPositions(): Array<{ x: number; y: number; displayY: number; index: number }> {
    const items = this.getItems();
    const positions: Array<{ x: number; y: number; displayY: number; index: number }> = [];

    for (let i = 0; i < items.length; i++) {
      if (this.collected.has(i)) continue;

      const item = items[i];
      const floatOffset = this.params.floatAnimation
        ? Math.sin(this.elapsed / 500 + i) * 6
        : 0;

      positions.push({
        x: item.x,
        y: item.y,
        displayY: item.y + floatOffset,
        index: i,
      });
    }

    return positions;
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    this.elapsed += dt;
  }

  reset(): void {
    this.collected.clear();
    this.elapsed = 0;
  }
}
