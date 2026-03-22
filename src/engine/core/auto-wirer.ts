import type { GameEngine, GameModule } from './types';
import type { Collision } from '@/engine/modules/mechanic/collision';

interface WiringRule {
  requires: string[];
  setup: (engine: GameEngine, modules: Map<string, GameModule>) => void;
}

const WIRING_RULES: WiringRule[] = [
  {
    // Spawner + Collision: auto-register spawned objects for collision detection
    requires: ['Spawner', 'Collision'],
    setup: (engine, modules) => {
      const collision = modules.get('Collision') as Collision;

      engine.eventBus.on('spawner:created', (data?: any) => {
        if (data?.id != null) {
          collision.registerObject(data.id, 'items', {
            x: data.x ?? 0,
            y: data.y ?? 0,
            radius: 20,
          });
        }
      });

      engine.eventBus.on('spawner:destroyed', (data?: any) => {
        if (data?.id != null) {
          collision.unregisterObject(data.id);
        }
      });
    },
  },
  // Timer + GameFlow: handled internally (GameFlow listens to timer:end)
  // Lives + GameFlow: handled internally (GameFlow listens to lives:zero)
];

export class AutoWirer {
  /**
   * Inspect the engine's modules and apply all matching wiring rules.
   */
  static wire(engine: GameEngine): void {
    // Build a map of module type -> first module instance
    const byType = new Map<string, GameModule>();
    for (const mod of engine.getAllModules()) {
      if (!byType.has(mod.type)) {
        byType.set(mod.type, mod);
      }
    }

    for (const rule of WIRING_RULES) {
      const allPresent = rule.requires.every((t) => byType.has(t));
      if (allPresent) {
        rule.setup(engine, byType);
      }
    }
  }
}
