import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface ActiveEffect {
  id: string;
  name: string;
  type: 'buff' | 'debuff';
  modifiers: { stat: string; value: number; mode: 'flat' | 'multiply' }[];
  duration: number;
  maxDuration: number;
  stacks: number;
  maxStacks: number;
  tickInterval: number;
  tickTimer: number;
  tickValue: number;
}

interface ApplyConfig {
  name: string;
  type: 'buff' | 'debuff';
  modifiers?: { stat: string; value: number; mode: 'flat' | 'multiply' }[];
  duration: number;
  maxStacks?: number;
  tickInterval?: number;
  tickValue?: number;
}

export class StatusEffect extends BaseModule {
  readonly type = 'StatusEffect';

  private effects: ActiveEffect[] = [];
  private nextId = 0;

  getSchema(): ModuleSchema {
    return {
      maxEffects: {
        type: 'range',
        label: 'Max Active Effects',
        default: 10,
        min: 1,
        max: 30,
        step: 1,
      },
      immunities: {
        type: 'object',
        label: 'Immunities',
        default: [],
      },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['status:immunity', 'status:stack', 'status:apply', 'status:tick', 'status:expire'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
  }

  applyEffect(config: ApplyConfig): void {
    const raw = this.params.immunities;
    const immunities: string[] = Array.isArray(raw) ? raw : Object.values(raw ?? {});
    if (immunities.includes(config.name)) {
      this.emit('status:immunity', { name: config.name });
      return;
    }

    const existingIdx = this.effects.findIndex((e) => e.name === config.name);
    if (existingIdx !== -1) {
      const existing = this.effects[existingIdx];
      const newStacks = Math.min(existing.stacks + 1, existing.maxStacks);
      if (newStacks > existing.stacks) {
        const updated: ActiveEffect = {
          ...existing,
          stacks: newStacks,
          duration: config.duration,
          maxDuration: config.duration,
        };
        this.effects = this.effects.map((e, i) => (i === existingIdx ? updated : e));
        this.emit('status:stack', { name: config.name, stacks: newStacks });
      } else {
        // At max stacks: just reset duration
        const updated: ActiveEffect = {
          ...existing,
          duration: config.duration,
          maxDuration: config.duration,
        };
        this.effects = this.effects.map((e, i) => (i === existingIdx ? updated : e));
      }
      return;
    }

    const maxEffects: number = this.params.maxEffects ?? 10;
    if (this.effects.length >= maxEffects) return;

    const effect: ActiveEffect = {
      id: String(this.nextId++),
      name: config.name,
      type: config.type,
      modifiers: config.modifiers ?? [],
      duration: config.duration,
      maxDuration: config.duration,
      stacks: 1,
      maxStacks: config.maxStacks ?? 1,
      tickInterval: config.tickInterval ?? 0,
      tickTimer: 0,
      tickValue: config.tickValue ?? 0,
    };

    this.effects = [...this.effects, effect];

    this.emit('status:apply', {
      name: effect.name,
      type: effect.type,
      duration: effect.duration,
      stacks: effect.stacks,
    });
  }

  removeEffect(name: string): void {
    this.effects = this.effects.filter((e) => e.name !== name);
  }

  hasEffect(name: string): boolean {
    return this.effects.some((e) => e.name === name);
  }

  getActiveEffects(): ActiveEffect[] {
    return [...this.effects];
  }

  getAggregatedModifiers(): { stat: string; value: number; mode: string }[] {
    const result: { stat: string; value: number; mode: string }[] = [];
    for (const effect of this.effects) {
      for (const mod of effect.modifiers) {
        result.push({ stat: mod.stat, value: mod.value * effect.stacks, mode: mod.mode });
      }
    }
    return result;
  }

  reset(): void {
    this.effects = [];
    this.nextId = 0;
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const expired: string[] = [];
    const nextEffects: ActiveEffect[] = [];

    for (const effect of this.effects) {
      const newDuration = effect.duration - dt;

      let newTickTimer = effect.tickTimer;
      if (effect.tickInterval > 0) {
        newTickTimer = effect.tickTimer + dt;
        let ticks = 0;
        while (newTickTimer >= effect.tickInterval) {
          newTickTimer -= effect.tickInterval;
          ticks++;
        }
        for (let i = 0; i < ticks; i++) {
          this.emit('status:tick', { name: effect.name, value: effect.tickValue });
        }
      }

      const updated: ActiveEffect = { ...effect, duration: newDuration, tickTimer: newTickTimer };

      if (newDuration <= 0) {
        expired.push(effect.name);
      } else {
        nextEffects.push(updated);
      }
    }

    this.effects = nextEffects;

    for (const name of expired) {
      this.emit('status:expire', { name });
    }
  }
}
