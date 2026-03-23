import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface EquippedItem {
  layer: string;
  itemId: string;
}

export class DressUpEngine extends BaseModule {
  readonly type = 'DressUpEngine';

  private equipped = new Map<string, string[]>(); // layer -> itemIds

  getSchema(): ModuleSchema {
    return {
      layers: {
        type: 'object',
        label: 'Layers',
        default: ['hat', 'glasses', 'shirt', 'pants', 'shoes'],
      },
      maxPerLayer: {
        type: 'range',
        label: 'Max per Layer',
        default: 1,
        min: 1,
        max: 3,
        step: 1,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    // Initialize empty equipment for each layer
    const layers: string[] = this.params.layers ?? [];
    for (const layer of layers) {
      this.equipped.set(layer, []);
    }

    this.on('input:touch:tap', (data?: any) => {
      if (data?.layer && data?.itemId) {
        this.equip(data.layer, data.itemId);
      }
    });
  }

  equip(layer: string, itemId: string): boolean {
    const layers: string[] = this.params.layers ?? [];
    if (!layers.includes(layer)) return false;

    const maxPerLayer = this.params.maxPerLayer ?? 1;
    let items = this.equipped.get(layer) ?? [];

    // Already equipped
    if (items.includes(itemId)) return false;

    // If at max, remove oldest
    if (items.length >= maxPerLayer) {
      const removed = items.shift()!;
      this.emit('dressup:unequip', { layer, itemId: removed });
    }

    items.push(itemId);
    this.equipped.set(layer, items);

    this.emit('dressup:equip', { layer, itemId });
    return true;
  }

  unequip(layer: string, itemId: string): boolean {
    const items = this.equipped.get(layer);
    if (!items) return false;

    const index = items.indexOf(itemId);
    if (index === -1) return false;

    items.splice(index, 1);
    this.emit('dressup:unequip', { layer, itemId });
    return true;
  }

  getLayers(): string[] {
    return (this.params.layers as string[]) ?? [];
  }

  getEquipped(layer?: string): EquippedItem[] {
    const result: EquippedItem[] = [];

    if (layer) {
      const items = this.equipped.get(layer) ?? [];
      for (const itemId of items) {
        result.push({ layer, itemId });
      }
    } else {
      for (const [l, items] of this.equipped) {
        for (const itemId of items) {
          result.push({ layer: l, itemId });
        }
      }
    }

    return result;
  }

  snapshot(): EquippedItem[] {
    const result = this.getEquipped();
    this.emit('dressup:snapshot', { equipped: result });
    return result;
  }

  clearLayer(layer: string): void {
    const items = this.equipped.get(layer);
    if (!items) return;

    for (const itemId of items) {
      this.emit('dressup:unequip', { layer, itemId });
    }
    this.equipped.set(layer, []);
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    const layers: string[] = this.params.layers ?? [];
    this.equipped.clear();
    for (const layer of layers) {
      this.equipped.set(layer, []);
    }
  }
}
