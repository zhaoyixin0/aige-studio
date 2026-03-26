import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface LootEntry {
  item: string;
  weight: number;
  minCount: number;
  maxCount: number;
  type: 'collectible' | 'equipment' | 'xp' | 'health';
}

export class EnemyDrop extends BaseModule {
  readonly type = 'EnemyDrop';

  getSchema(): ModuleSchema {
    return {
      lootTable: {
        type: 'object',
        label: 'Loot Table',
        default: [],
      },
      dropChance: {
        type: 'range',
        label: 'Drop Chance',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.8,
      },
      triggerEvent: {
        type: 'string',
        label: 'Trigger Event',
        default: 'enemy:death',
      },
      xpAmount: {
        type: 'range',
        label: 'XP Amount',
        min: 0,
        max: 1000,
        default: 10,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    const triggerEvent: string = this.params.triggerEvent ?? 'enemy:death';
    this.on(triggerEvent, (data?: any) => {
      const x: number = data?.x ?? 0;
      const y: number = data?.y ?? 0;
      this.rollDrop(x, y);
    });
  }

  rollDrop(x: number, y: number): void {
    // Always award XP
    const xpAmount: number = this.params.xpAmount ?? 10;
    this.emit('levelup:xp', { amount: xpAmount });

    const dropChance: number = this.params.dropChance ?? 0.8;
    if (Math.random() >= dropChance) return;

    const lootTable: LootEntry[] = this.getLootTable();
    if (lootTable.length === 0) return;

    const entry = this.pickWeighted(lootTable);
    if (!entry) return;

    const count = this.rollCount(entry.minCount, entry.maxCount);
    this.emit('drop:spawn', { x, y, item: entry.item, count, type: entry.type });
  }

  reset(): void {
    // Stateless module — no-op
  }

  update(_dt: number): void {
    // No per-frame logic needed
  }

  private getLootTable(): LootEntry[] {
    const raw = this.params.lootTable;
    return Array.isArray(raw) ? raw : [];
  }

  private pickWeighted(table: LootEntry[]): LootEntry | null {
    const total = table.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= entry.weight ?? 1;
      if (roll <= 0) return entry;
    }
    return table[table.length - 1];
  }

  private rollCount(min: number, max: number): number {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }
}
