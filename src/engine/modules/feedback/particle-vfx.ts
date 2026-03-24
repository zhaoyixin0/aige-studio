import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface ParticleConfig {
  effect: string;
  at: 'target' | 'player' | 'center';
  duration: number;
  color: string;
}

export interface ActiveParticle {
  effect: string;
  at: 'target' | 'player' | 'center';
  color: string;
  lifetime: number;
  maxLifetime: number;
}

export class ParticleVFX extends BaseModule {
  readonly type = 'ParticleVFX';

  private particles: ActiveParticle[] = [];

  getSchema(): ModuleSchema {
    return {
      events: {
        type: 'object',
        label: '事件→特效映射',
        default: {},
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const events: Record<string, ParticleConfig> = this.params.events ?? {};
    for (const [eventName, config] of Object.entries(events)) {
      this.on(eventName, () => {
        this.particles.push({
          effect: config.effect,
          at: config.at,
          color: config.color,
          lifetime: 0,
          maxLifetime: config.duration,
        });
      });
    }
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    // Advance lifetimes and remove expired particles
    for (const particle of this.particles) {
      particle.lifetime += dt;
    }
    this.particles = this.particles.filter(
      (p) => p.lifetime < p.maxLifetime,
    );
  }

  getActiveParticles(): ActiveParticle[] {
    return [...this.particles];
  }

  reset(): void {
    this.particles = [];
  }
}
