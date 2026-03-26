import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export type SlotType = 'weapon' | 'armor' | 'accessory' | 'helmet' | 'boots';

export interface Equipment {
  id: string;
  name: string;
  slot: SlotType;
  stats: Record<string, number>;
  asset: string;
}

export class EquipmentSlot extends BaseModule {
  readonly type = 'EquipmentSlot';

  private equipped: Map<SlotType, Equipment> = new Map();
  private available: Equipment[] = [];

  getSchema(): ModuleSchema {
    return {
      slots: {
        type: 'object',
        label: 'Allowed Slots',
        default: ['weapon', 'armor', 'accessory'],
      },
      equipEvent: {
        type: 'string',
        label: 'Equip Event',
        default: 'collectible:pickup',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    const equipEvent: string = this.params.equipEvent ?? 'collectible:pickup';
    this.on(equipEvent, (data?: any) => this.handleAutoEquip(data));
  }

  private handleAutoEquip(data?: any): void {
    if (!data?.id) return;
    const item = this.available.find((a) => a.id === data.id);
    if (!item) return;
    const slots: SlotType[] = this.getAllowedSlots();
    if (!slots.includes(item.slot)) return;
    const current = this.equipped.get(item.slot);
    if (!current) {
      this.equip(item.id);
      return;
    }
    // equip if better (higher total stat sum)
    const currentTotal = Object.values(current.stats).reduce((s, v) => s + v, 0);
    const newTotal = Object.values(item.stats).reduce((s, v) => s + v, 0);
    if (newTotal > currentTotal) {
      this.equip(item.id);
    }
  }

  addEquipment(item: Equipment): void {
    if (!this.available.some((a) => a.id === item.id)) {
      this.available = [...this.available, item];
    }
  }

  equip(itemId: string): boolean {
    const idx = this.available.findIndex((a) => a.id === itemId);
    if (idx === -1) return false;
    const item = this.available[idx];
    const slots = this.getAllowedSlots();
    if (!slots.includes(item.slot)) return false;

    // Return currently equipped item in that slot back to available
    const displaced = this.equipped.get(item.slot);
    if (displaced) {
      this.available = [...this.available, displaced];
    }

    // Remove item from available
    this.available = this.available.filter((a) => a.id !== itemId);
    this.equipped = new Map(this.equipped).set(item.slot, item);

    const totalStats = this.getAggregatedStats();
    this.emit('equipment:equip', { slot: item.slot, item, totalStats });
    this.emit('equipment:stats', { stats: totalStats });
    return true;
  }

  unequip(slot: SlotType): Equipment | undefined {
    const item = this.equipped.get(slot);
    if (!item) return undefined;
    const next = new Map(this.equipped);
    next.delete(slot);
    this.equipped = next;
    this.available = [...this.available, item];
    this.emit('equipment:unequip', { slot, item });
    this.emit('equipment:stats', { stats: this.getAggregatedStats() });
    return item;
  }

  getEquipped(slot: SlotType): Equipment | undefined {
    return this.equipped.get(slot);
  }

  getAllEquipped(): Equipment[] {
    return Array.from(this.equipped.values());
  }

  getAggregatedStats(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of this.equipped.values()) {
      for (const [stat, val] of Object.entries(item.stats)) {
        result[stat] = (result[stat] ?? 0) + val;
      }
    }
    return result;
  }

  reset(): void {
    this.equipped = new Map();
    this.available = [];
  }

  update(_dt: number): void {
    // No per-frame logic needed
  }

  private getAllowedSlots(): SlotType[] {
    const raw = this.params.slots;
    if (Array.isArray(raw)) return raw as SlotType[];
    return ['weapon', 'armor', 'accessory'];
  }
}
