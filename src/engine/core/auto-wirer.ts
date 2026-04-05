import type { GameEngine, GameModule, EventHandler } from './types';
import type { ModuleContracts, CollisionProviderContract } from './contracts';
import type { Collision } from '@/engine/modules/mechanic/collision';
import type { Health } from '@/engine/modules/mechanic/health';
import type { Gravity } from '@/engine/modules/mechanic/gravity';
import type { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import type { EnemyAI } from '@/engine/modules/mechanic/enemy-ai';

/** Narrow event payload to a record for safe property access */
const asRecord = (data: unknown): Record<string, unknown> =>
  typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

// ── Phase D: Module-specific bridges that can't be expressed as contracts ──

interface WiringRule {
  requires: string[];
  setup: (engine: GameEngine, modules: Map<string, GameModule>, on: (event: string, handler: EventHandler) => void) => void;
}

const BRIDGE_RULES: WiringRule[] = [
  {
    requires: ['StaticPlatform', 'Gravity'],
    setup: (_engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const sp = modules.get('StaticPlatform') as any;
      const platforms = sp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        gravity.addSurface({
          id: `static-${sp.id}-${i}`,
          x: p.x, y: p.y, width: p.width, oneWay: false, active: true,
        });
      }
    },
  },
  {
    requires: ['MovingPlatform', 'Gravity'],
    setup: (_engine, modules, on) => {
      const gravity = modules.get('Gravity') as Gravity;
      const mp = modules.get('MovingPlatform') as any;
      const positions = mp.getPlatformPositions?.() ?? [];
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        gravity.addSurface({
          id: `moving-${mp.id}-${i}`,
          x: p.x, y: p.y, width: p.width, oneWay: false, active: true,
        });
      }
      on('platform:move', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          gravity.updateSurface(`moving-${mp.id}-${d.id}`, {
            x: d.x as number, y: d.y as number, width: d.width as number,
          });
        }
      });
    },
  },
  {
    requires: ['OneWayPlatform', 'Gravity'],
    setup: (_engine, modules) => {
      const gravity = modules.get('Gravity') as Gravity;
      const owp = modules.get('OneWayPlatform') as any;
      const platforms = owp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        gravity.addSurface({
          id: `oneway-${owp.id}-${i}`,
          x: p.x, y: p.y, width: p.width, oneWay: true, active: true,
        });
      }
    },
  },
  {
    requires: ['CrumblingPlatform', 'Gravity'],
    setup: (_engine, modules, on) => {
      const gravity = modules.get('Gravity') as Gravity;
      const cp = modules.get('CrumblingPlatform') as any;
      const platforms = cp.getPlatforms?.() ?? [];
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i] as any;
        gravity.addSurface({
          id: `crumble-${i}`,
          x: p.x ?? 0, y: p.y ?? 0, width: p.width ?? 100,
          oneWay: false, active: true,
        });
      }
      on('platform:crumble', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          const id = String(d.id);
          gravity.updateSurface(id, { active: false });
          const obj = gravity.getObject('player');
          if (obj?.currentSurfaceId === id) {
            gravity.checkSurfaceDeparture('player');
          }
        }
      });
      on('platform:respawn', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          gravity.updateSurface(String(d.id), { active: true });
        }
      });
    },
  },
  {
    requires: ['Knockback', 'PlayerMovement'],
    setup: (_engine, modules, on) => {
      const pm = modules.get('PlayerMovement') as PlayerMovement;
      on('knockback:start', () => { pm.lockInput(); });
      on('knockback:end', () => { pm.unlockInput(); });
    },
  },
  {
    // Collision + Tween: collision hits trigger tween animations
    requires: ['Collision', 'Tween'],
    setup: (engine, _modules, on) => {
      on('collision:hit', (data?: unknown) => {
        const d = asRecord(data);
        if (d.targetId != null) {
          engine.eventBus.emit('tween:trigger', {
            clipId: 'hit',
            entityId: String(d.targetId),
          });
        }
      });
    },
  },
  {
    // Spawner + Tween: spawn/despawn trigger tween animations
    requires: ['Spawner', 'Tween'],
    setup: (engine, _modules, on) => {
      on('spawner:created', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          engine.eventBus.emit('tween:trigger', {
            clipId: 'spawn-in',
            entityId: String(d.id),
          });
        }
      });
      on('spawner:destroyed', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          engine.eventBus.emit('tween:trigger', {
            clipId: 'despawn-out',
            entityId: String(d.id),
          });
        }
      });
    },
  },
  {
    // EnemyAI + Tween: enemy death triggers fade animation
    requires: ['EnemyAI', 'Tween'],
    setup: (engine, _modules, on) => {
      on('enemy:death', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          engine.eventBus.emit('tween:trigger', {
            clipId: 'death-fade',
            entityId: String(d.id),
          });
        }
      });
    },
  },
  {
    // WaveSpawner + EnemyAI: spawn enemies into AI system
    requires: ['WaveSpawner', 'EnemyAI'],
    setup: (_engine, modules, on) => {
      const enemyAI = modules.get('EnemyAI') as unknown as EnemyAI;

      on('wave:spawn', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          enemyAI.addEnemy(String(d.id), Number(d.x ?? 0), Number(d.y ?? 0));
        }
      });

      on('enemy:death', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id != null) {
          enemyAI.removeEnemy(String(d.id));
        }
      });
    },
  },
];

// ── Layer→Module lookup ──

interface LayerOwner {
  module: GameModule;
  contract: CollisionProviderContract;
  contracts: ModuleContracts;
}

export class AutoWirer {
  /** Tracked listeners from the last wire() call, keyed by engine identity */
  private static wiringListeners = new WeakMap<GameEngine, Array<{ event: string; handler: EventHandler }>>();

  /** Remove all listeners registered by a previous wire() call */
  private static unwire(engine: GameEngine): void {
    const tracked = AutoWirer.wiringListeners.get(engine);
    if (tracked) {
      for (const { event, handler } of tracked) {
        engine.eventBus.off(event, handler);
      }
    }
    AutoWirer.wiringListeners.set(engine, []);
  }

  /** Register an event listener and track it for cleanup on re-wire */
  private static on(engine: GameEngine, event: string, handler: EventHandler): void {
    engine.eventBus.on(event, handler);
    const tracked = AutoWirer.wiringListeners.get(engine);
    if (tracked) {
      tracked.push({ event, handler });
    }
  }

  static wire(engine: GameEngine): void {
    // Clean up previous wiring listeners to prevent accumulation on re-wire
    AutoWirer.unwire(engine);

    const byType = new Map<string, GameModule>();
    for (const mod of engine.getAllModules()) {
      if (!byType.has(mod.type)) {
        byType.set(mod.type, mod);
      }
    }

    const collision = byType.get('Collision') as Collision | undefined;

    // Build layer owner map ONCE, shared across all phases
    const layerOwners = AutoWirer.buildLayerOwnerMap(engine);

    // ── Phase A: Object Registration via Contracts ──
    if (collision) {
      AutoWirer.wirePhaseA(engine, collision, layerOwners);
    }

    // ── Phase B: Damage Routing via Contracts ──
    if (collision) {
      AutoWirer.wirePhaseB(engine, collision, layerOwners);
    }

    // ── Phase C: Queries ──
    AutoWirer.wirePhaseC(engine, layerOwners);

    // ── Phase D: Module-specific bridges ──
    const trackedOn = (event: string, handler: EventHandler) => AutoWirer.on(engine, event, handler);
    for (const rule of BRIDGE_RULES) {
      if (rule.requires.every((t) => byType.has(t))) {
        rule.setup(engine, byType, trackedOn);
      }
    }

    // ── Phase D extra: health:zero → lives:zero bridge ──
    if (byType.has('Health')) {
      AutoWirer.on(engine, 'health:zero', (data?: unknown) => {
        const d = asRecord(data);
        if (d.id === 'player_1') {
          engine.eventBus.emit('lives:zero', {});
        }
      });
    }
  }

  /** Phase A: Register collision objects from module contracts */
  private static wirePhaseA(
    engine: GameEngine,
    collision: Collision,
    layerOwners: Map<string, LayerOwner>,
  ): void {
    for (const { contract } of layerOwners.values()) {
      // Spawn event → register (with per-object layer routing if available)
      if (contract.spawnEvent) {
        AutoWirer.on(engine, contract.spawnEvent, (data?: unknown) => {
          const d = asRecord(data);
          if (d.id != null) {
            const objData = { asset: d.asset as string | undefined, id: d.id as string | undefined };
            const layer = contract.getLayerForObject
              ? contract.getLayerForObject(objData)
              : contract.layer;
            collision.registerObject(String(d.id), layer, {
              x: Number(d.x ?? 0),
              y: Number(d.y ?? 0),
              radius: contract.radius,
            });
          }
        });
      }

      // Destroy event → unregister
      if (contract.destroyEvent) {
        AutoWirer.on(engine, contract.destroyEvent, (data?: unknown) => {
          const d = asRecord(data);
          if (d.id != null) {
            collision.unregisterObject(String(d.id));
          }
        });
      }

      // Move event → update position
      if (contract.moveEvent) {
        AutoWirer.on(engine, contract.moveEvent, (data?: unknown) => {
          const d = asRecord(data);
          if (d.id != null) {
            collision.updateObject(String(d.id), { x: Number(d.x ?? 0), y: Number(d.y ?? 0) });
          }
        });
      }

      // Initial registration for pre-defined objects (e.g., Collectible items placed at init)
      if (contract.getActiveObjects && !contract.spawnEvent) {
        for (const obj of contract.getActiveObjects()) {
          collision.registerObject(obj.id, contract.layer, {
            x: obj.x,
            y: obj.y,
            radius: contract.radius,
          });
        }
      }

      // Batch sync via pre-update hook (for modules with getActiveObjects)
      if (contract.getActiveObjects) {
        const getObjects = contract.getActiveObjects.bind(contract);
        collision.addPreUpdateHook(() => {
          for (const obj of getObjects()) {
            collision.updateObject(obj.id, { x: obj.x, y: obj.y });
          }
        });
      }
    }

    // Player registration from playerPosition contracts
    for (const mod of engine.getAllModules()) {
      const contracts = mod.getContracts();
      if (contracts.playerPosition) {
        const pp = contracts.playerPosition;
        const pos = pp.getPosition();
        collision.registerObject('player_1', 'player', {
          x: pos.x, y: pos.y, radius: pp.radius,
        });

        collision.addPreUpdateHook(() => {
          const p = pp.getPosition();
          collision.updateObject('player_1', { x: p.x, y: p.y });
        });

        // Auto-register player entity in Health module
        const healthMod = engine.getModulesByType('Health')[0] as Health | undefined;
        healthMod?.registerEntity('player_1');
      }
    }
  }

  /** Phase B: Route damage based on collision rules + contracts */
  private static wirePhaseB(
    engine: GameEngine,
    collision: Collision,
    layerOwners: Map<string, LayerOwner>,
  ): void {
    const rules = (collision.getParams().rules ?? []) as Array<{ a: string; b: string; event: string; destroy?: string[] }>;

    // Build lookup for playerPosition → Health damageReceiver
    let healthReceiver: { handle: (id: string, amount: number) => void } | undefined;
    for (const mod of engine.getAllModules()) {
      const c = mod.getContracts();
      if (c.damageReceiver && mod.type === 'Health') {
        healthReceiver = c.damageReceiver;
      }
    }

    for (const rule of rules) {
      const eventName = `collision:${rule.event}`;

      AutoWirer.on(engine, eventName, (data?: unknown) => {
        const d = asRecord(data);
        // Only process events from Collision module (must have objectA/objectB)
        if (!d.objectA || !d.objectB) return;

        // Convention: 'hit' = A damages B, 'damage' = B damages A
        const isHit = rule.event === 'hit';
        const sourceLayer = isHit ? rule.a : rule.b;
        const targetLayer = isHit ? rule.b : rule.a;
        const targetObjectId = String(isHit ? d.objectB : d.objectA);

        const sourceOwner = layerOwners.get(sourceLayer);
        const targetOwner = layerOwners.get(targetLayer);

        const amount = sourceOwner?.contracts.damageSource?.amount ?? 1;

        // Route to target's damageReceiver (exclusive: use layer owner if available, else Health for player)
        if (targetOwner?.contracts.damageReceiver) {
          targetOwner.contracts.damageReceiver.handle(targetObjectId, amount);
        } else if (targetLayer === 'player' && healthReceiver) {
          healthReceiver.handle('player_1', amount);
        }
      });
    }
  }

  /** Phase C: Query handlers */
  private static wirePhaseC(
    engine: GameEngine,
    layerOwners: Map<string, LayerOwner>,
  ): void {
    AutoWirer.on(engine, 'aim:queryTargets', (data?: unknown) => {
      const d = asRecord(data);
      if (!d.layer || typeof d.callback !== 'function') return;

      const owner = layerOwners.get(String(d.layer));
      const cb = d.callback as (objects: ReadonlyArray<{ id: string; x: number; y: number }>) => void;
      if (owner?.contract.getActiveObjects) {
        cb(owner.contract.getActiveObjects());
      } else {
        cb([]);
      }
    });
  }

  /** Build a map of collision layer → owning module + contract */
  private static buildLayerOwnerMap(engine: GameEngine): Map<string, LayerOwner> {
    const map = new Map<string, LayerOwner>();

    for (const mod of engine.getAllModules()) {
      const contracts = mod.getContracts();
      if (contracts.collisionProvider) {
        map.set(contracts.collisionProvider.layer, {
          module: mod,
          contract: contracts.collisionProvider,
          contracts,
        });
      }
    }

    return map;
  }
}
