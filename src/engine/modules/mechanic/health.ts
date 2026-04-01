import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface HealthEntity {
  id: string;
  hp: number;
  maxHp: number;
}

export class Health extends BaseModule {
  readonly type = 'Health';

  private entities = new Map<string, HealthEntity>();

  getSchema(): ModuleSchema {
    return {
      maxHp: {
        type: 'number',
        label: 'Default Max HP',
        default: 100,
        min: 1,
        max: 9999,
      },
      damageEvent: {
        type: 'string',
        label: 'Damage Event',
        default: 'collision:damage',
      },
      healEvent: {
        type: 'string',
        label: 'Heal Event',
        default: '',
      },
      showBar: {
        type: 'boolean',
        label: 'Show Health Bar',
        default: true,
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      damageReceiver: {
        handle: (targetId, amount) => this.damage(targetId, amount),
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const damageEvent = this.params.damageEvent as string;
    if (damageEvent) {
      this.on(damageEvent, (data: unknown) => {
        const { targetId, amount } = extractDamageData(data);
        if (targetId) this.damage(targetId, amount);
      });
    }

    const healEvent = this.params.healEvent as string;
    if (healEvent) {
      this.on(healEvent, (data: unknown) => {
        const { targetId, amount } = extractDamageData(data);
        if (targetId) this.heal(targetId, amount);
      });
    }
  }

  registerEntity(id: string, maxHp?: number): void {
    const resolvedMax = maxHp ?? (this.params.maxHp as number);
    this.entities.set(id, { id, hp: resolvedMax, maxHp: resolvedMax });
  }

  damage(id: string, amount: number): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    if (entity.hp <= 0) return;

    const delta = -Math.min(amount, entity.hp);
    const updated: HealthEntity = { ...entity, hp: entity.hp + delta };
    this.entities.set(id, updated);

    this.emit('health:change', {
      id,
      hp: updated.hp,
      maxHp: updated.maxHp,
      delta,
    });

    if (updated.hp <= 0) {
      this.emit('health:zero', { id });
    }
  }

  heal(id: string, amount: number): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    const delta = Math.min(amount, entity.maxHp - entity.hp);
    if (delta <= 0) return;

    const updated: HealthEntity = { ...entity, hp: entity.hp + delta };
    this.entities.set(id, updated);

    this.emit('health:change', {
      id,
      hp: updated.hp,
      maxHp: updated.maxHp,
      delta,
    });
  }

  getEntity(id: string): HealthEntity | undefined {
    return this.entities.get(id);
  }

  reset(): void {
    this.entities.clear();
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }
}

function extractDamageData(data: unknown): { targetId: string | undefined; amount: number } {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    return {
      targetId: typeof d['targetId'] === 'string' ? d['targetId'] : undefined,
      amount: typeof d['amount'] === 'number' ? d['amount'] : 1,
    };
  }
  return { targetId: undefined, amount: 1 };
}
