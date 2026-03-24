import type { GameEngine, GameModule } from './types';
import type { Collision } from '@/engine/modules/mechanic/collision';
import type { Spawner } from '@/engine/modules/mechanic/spawner';

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
      const spawner = modules.get('Spawner') as Spawner;

      engine.eventBus.on('spawner:created', (data?: any) => {
        if (data?.id != null) {
          const spriteSize = (spawner as any).getParams().spriteSize ?? 48;
          const radius = spriteSize / 2;
          collision.registerObject(data.id, 'items', {
            x: data.x ?? 0,
            y: data.y ?? 0,
            radius,
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
  {
    // Collectible + Collision: auto-register collectible items for collision detection
    requires: ['Collectible', 'Collision'],
    setup: (engine, modules) => {
      const collision = modules.get('Collision') as Collision;
      const collectible = modules.get('Collectible') as any;
      const collectibleSize = collectible.getParams?.().spriteSize ?? 32;
      const collectibleRadius = collectibleSize / 2;
      const items = collectible.getActiveItems?.() ?? [];
      for (let i = 0; i < items.length; i++) {
        collision.registerObject(`collectible-${i}`, 'collectibles', {
          x: items[i].x, y: items[i].y, radius: collectibleRadius,
        });
      }
    },
  },
  // Timer + GameFlow: handled internally (GameFlow listens to timer:end)
  // Lives + GameFlow: handled internally (GameFlow listens to lives:zero)
  // Checkpoint + Lives: handled internally (Checkpoint listens to lives:zero)
  // IFrames + Collision: checked via iframes.isActive() at runtime
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
