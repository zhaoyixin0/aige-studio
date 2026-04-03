import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
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
      magnetRadius: {
        type: 'range',
        label: 'Magnet Radius',
        default: 16,
        min: 0,
        max: 200,
        step: 1,
      },
      floatAmplitude: {
        type: 'range',
        label: 'Float Amplitude',
        default: 6,
        min: 1,
        max: 30,
        step: 1,
      },
      floatFrequency: {
        type: 'range',
        label: 'Float Frequency (ms)',
        default: 500,
        min: 100,
        max: 2000,
        step: 50,
      },
    };
  }

  getContracts(): ModuleContracts {
    const layer = (this.params.layer as string) ?? 'collectibles';
    const magnetRadius = (this.params.magnetRadius as number) ?? 16;

    return {
      collisionProvider: {
        layer,
        radius: magnetRadius,
        getActiveObjects: () => {
          const allItems = this.getItems();
          const result: Array<{ id: string; x: number; y: number }> = [];
          for (let i = 0; i < allItems.length; i++) {
            if (!this.collected.has(i)) {
              result.push({ id: `collectible-${i}`, x: allItems[i].x, y: allItems[i].y });
            }
          }
          return result;
        },
      },
      emits: ['collectible:pickup', 'collectible:allCollected'],
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
      const magnetRadius = (this.params.magnetRadius as number) ?? 16;
      const threshold = radius + magnetRadius;

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
      const amplitude = (this.params.floatAmplitude as number) ?? 6;
      const frequency = (this.params.floatFrequency as number) ?? 500;
      const floatOffset = this.params.floatAnimation
        ? Math.sin(this.elapsed / frequency + i) * amplitude
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
