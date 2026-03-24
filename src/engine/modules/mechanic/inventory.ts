import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface ResourceDef {
  name: string;
  max: number;
  initial: number;
}

export class Inventory extends BaseModule {
  readonly type = 'Inventory';

  private amounts = new Map<string, number>();

  getSchema(): ModuleSchema {
    return {
      resources: {
        type: 'object',
        label: 'Resources',
        default: [],
      },
      trackEvent: {
        type: 'string',
        label: 'Track Event',
        default: 'collectible:pickup',
      },
    };
  }

  getDependencies() { return { requires: [], optional: ['Collectible'] }; }

  init(engine: GameEngine): void {
    super.init(engine);
    this.initializeAmounts();

    this.on(this.params.trackEvent, (data?: any) => {
      if (data?.type && data?.value != null) {
        this.add(data.type, data.value);
      }
    });
  }

  private getResources(): ResourceDef[] {
    const raw = this.params.resources;
    return Array.isArray(raw) ? raw : [];
  }

  private initializeAmounts(): void {
    this.amounts.clear();
    for (const def of this.getResources()) {
      this.amounts.set(def.name, def.initial);
    }
  }

  add(resource: string, amount: number): void {
    const defs = this.getResources();
    const def = defs.find((d) => d.name === resource);
    if (!def) return;

    const current = this.amounts.get(resource) ?? 0;
    const total = Math.min(current + amount, def.max);
    this.amounts.set(resource, total);

    this.emit('inventory:change', { resource, amount, total });

    if (total >= def.max) {
      this.emit('inventory:full', { resource });
    }
  }

  spend(resource: string, amount: number): boolean {
    const current = this.amounts.get(resource) ?? 0;
    if (current < amount) return false;

    const total = current - amount;
    this.amounts.set(resource, total);

    this.emit('inventory:change', { resource, amount: -amount, total });

    return true;
  }

  getAmount(resource: string): number {
    return this.amounts.get(resource) ?? 0;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.initializeAmounts();
  }
}
