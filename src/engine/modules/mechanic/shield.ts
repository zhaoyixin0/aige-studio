import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export class Shield extends BaseModule {
  readonly type = 'Shield';

  private charges = 0;
  private rechargeTimer = 0;

  getSchema(): ModuleSchema {
    return {
      maxCharges: {
        type: 'number',
        label: 'Max Charges',
        default: 3,
        min: 1,
        max: 10,
      },
      rechargeCooldown: {
        type: 'number',
        label: 'Recharge Cooldown',
        default: 5000,
        min: 1000,
        max: 30000,
      },
      damageEvent: {
        type: 'string',
        label: 'Damage Event',
        default: 'collision:damage',
      },
    };
  }

  getContracts(): ModuleContracts {
    const damageEvent: string = (this.params.damageEvent as string) ?? 'collision:damage';
    return {
      emits: [
        'shield:absorbed',
        'shield:damage:passthrough',
        'shield:block',
        'shield:break',
        'shield:recharge',
      ],
      consumes: [damageEvent],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.charges = this.params.maxCharges as number;
    this.rechargeTimer = 0;

    const damageEvent = this.params.damageEvent as string;
    if (damageEvent) {
      this.on(damageEvent, (data: unknown) => {
        if (this.absorb()) {
          this.emit('shield:absorbed', data);
        } else {
          this.emit('shield:damage:passthrough', data);
        }
      });
    }
  }

  getCharges(): number {
    return this.charges;
  }

  isActive(): boolean {
    return this.charges > 0;
  }

  absorb(): boolean {
    if (this.charges <= 0) return false;

    this.charges -= 1;
    this.emit('shield:block', { chargesRemaining: this.charges });

    if (this.charges === 0) {
      this.emit('shield:break');
    }

    return true;
  }

  reset(): void {
    this.charges = this.params.maxCharges as number;
    this.rechargeTimer = 0;
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const maxCharges = this.params.maxCharges as number;
    if (this.charges >= maxCharges) return;

    const cooldown = this.params.rechargeCooldown as number;
    this.rechargeTimer += dt;

    if (this.rechargeTimer >= cooldown) {
      this.rechargeTimer = 0;
      this.charges = Math.min(this.charges + 1, maxCharges);
      this.emit('shield:recharge', { chargesRemaining: this.charges });
    }
  }
}
