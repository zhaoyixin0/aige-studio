import type { GameEngine, GameModule } from './types';
import type { Collision } from '@/engine/modules/mechanic/collision';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { Gravity } from '@/engine/modules/mechanic/gravity';
import type { PlayerMovement } from '@/engine/modules/mechanic/player-movement';

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

      // Build asset→layer lookup from spawner item config
      const itemConfigs: Array<{ asset: string; layer?: string }> =
        (spawner as any).getParams().items ?? [];
      const assetLayerMap = new Map<string, string>();
      for (const item of itemConfigs) {
        if (item.layer) assetLayerMap.set(item.asset, item.layer);
      }

      engine.eventBus.on('spawner:created', (data?: any) => {
        if (data?.id != null) {
          const spriteSize = (spawner as any).getParams().spriteSize ?? 48;
          const radius = spriteSize / 2;
          const layer = assetLayerMap.get(data.asset) ?? 'items';
          collision.registerObject(data.id, layer, {
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

      // Sync spawned object positions with collision each frame.
      // Spawner moves objects in its update() but doesn't notify Collision.
      const originalUpdate = collision.update.bind(collision);
      collision.update = (dt: number) => {
        for (const obj of spawner.getObjects()) {
          collision.updateObject(obj.id, { x: obj.x, y: obj.y });
        }
        originalUpdate(dt);
      };
    },
  },
  {
    // Collectible + Collision: auto-register collectible items for collision detection
    requires: ['Collectible', 'Collision'],
    setup: (_engine, modules) => {
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
  {
    // StaticPlatform + Gravity: register static platform surfaces
    requires: ['StaticPlatform', 'Gravity'],
    setup: (_engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const sp = modules.get('StaticPlatform') as any;
      const platforms = sp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        gravity.addSurface({
          id: `static-${sp.id}-${i}`,
          x: p.x,
          y: p.y,
          width: p.width,
          oneWay: false,
          active: true,
        });
      }
    },
  },
  {
    // MovingPlatform + Gravity: register and dynamically update surfaces
    requires: ['MovingPlatform', 'Gravity'],
    setup: (engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const mp = modules.get('MovingPlatform') as any;
      const positions = mp.getPlatformPositions?.() ?? [];
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        gravity.addSurface({
          id: `moving-${mp.id}-${i}`,
          x: p.x,
          y: p.y,
          width: p.width,
          oneWay: false,
          active: true,
        });
      }
      // Update surface position each frame via platform:move events
      engine.eventBus.on('platform:move', (data?: any) => {
        if (data?.id != null) {
          gravity.updateSurface(`moving-${mp.id}-${data.id}`, {
            x: data.x,
            y: data.y,
            width: data.width,
          });
        }
      });
    },
  },
  {
    // OneWayPlatform + Gravity: register one-way surfaces
    requires: ['OneWayPlatform', 'Gravity'],
    setup: (_engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const owp = modules.get('OneWayPlatform') as any;
      const platforms = owp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        gravity.addSurface({
          id: `oneway-${owp.id}-${i}`,
          x: p.x,
          y: p.y,
          width: p.width,
          oneWay: true,
          active: true,
        });
      }
    },
  },
  {
    // CrumblingPlatform + Gravity: register surfaces, deactivate on crumble, reactivate on respawn
    requires: ['CrumblingPlatform', 'Gravity'],
    setup: (engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const cp = modules.get('CrumblingPlatform') as any;
      const platforms = cp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i] as any;
        gravity.addSurface({
          id: `crumble-${i}`,
          x: p.x ?? 0,
          y: p.y ?? 0,
          width: p.width ?? 100,
          oneWay: false,
          active: true,
        });
      }
      engine.eventBus.on('platform:crumble', (data?: any) => {
        if (data?.id != null) {
          gravity.updateSurface(data.id, { active: false });
          // Check if any object on this surface needs to fall
          const obj = gravity.getObject('player');
          if (obj?.currentSurfaceId === data.id) {
            gravity.checkSurfaceDeparture('player');
          }
        }
      });
      engine.eventBus.on('platform:respawn', (data?: any) => {
        if (data?.id != null) {
          gravity.updateSurface(data.id, { active: true });
        }
      });
    },
  },
  {
    // Knockback + PlayerMovement: lock input during knockback
    requires: ['Knockback', 'PlayerMovement'],
    setup: (engine, modules) => {
      const pm = modules.get('PlayerMovement') as PlayerMovement;
      engine.eventBus.on('knockback:start', () => {
        pm.lockInput();
      });
      engine.eventBus.on('knockback:end', () => {
        pm.unlockInput();
      });
    },
  },
  {
    // Projectile + Collision: register projectiles for collision detection
    requires: ['Projectile', 'Collision'],
    setup: (engine, modules) => {
      const collision = modules.get('Collision') as Collision;
      const projectile = modules.get('Projectile') as any;
      const layer = projectile.getParams?.().layer ?? 'projectiles';

      engine.eventBus.on('projectile:fire', (data?: any) => {
        if (data?.id != null) {
          collision.registerObject(data.id, layer, {
            x: data.x ?? 0,
            y: data.y ?? 0,
            radius: 8,
          });
        }
      });

      engine.eventBus.on('projectile:destroyed', (data?: any) => {
        if (data?.id != null) {
          collision.unregisterObject(data.id);
        }
      });

      // Sync projectile positions with collision each frame.
      // Wrap Collision.update so positions are current before collision checks.
      const originalUpdate = collision.update.bind(collision);
      collision.update = (dt: number) => {
        for (const p of projectile.getActiveProjectiles?.() ?? []) {
          collision.updateObject(p.id, { x: p.x, y: p.y });
        }
        originalUpdate(dt);
      };
    },
  },
  {
    // WaveSpawner + EnemyAI + Collision: register enemies for collision detection
    requires: ['WaveSpawner', 'Collision'],
    setup: (engine, modules) => {
      const collision = modules.get('Collision') as Collision;

      engine.eventBus.on('wave:spawn', (data?: any) => {
        if (data?.id != null) {
          collision.registerObject(data.id, 'enemies', {
            x: data.x ?? 0,
            y: data.y ?? 0,
            radius: 24,
          });
        }
      });

      engine.eventBus.on('enemy:move', (data?: any) => {
        if (data?.id != null) {
          collision.updateObject(data.id, {
            x: data.x ?? 0,
            y: data.y ?? 0,
          });
        }
      });

      engine.eventBus.on('enemy:death', (data?: any) => {
        if (data?.id != null) {
          collision.unregisterObject(data.id);
        }
      });
    },
  },
  // Timer + GameFlow: handled internally (GameFlow listens to timer:end)
  // Lives + GameFlow: handled internally (GameFlow listens to lives:zero)
  // Checkpoint + Lives: handled internally (Checkpoint listens to lives:zero)
  // IFrames + Collision: checked via iframes.isActive() at runtime
  // Dash + Gravity: handled internally (Gravity listens to dash:start/dash:end)
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
