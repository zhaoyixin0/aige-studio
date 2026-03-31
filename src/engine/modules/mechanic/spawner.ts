import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface SpawnedObject {
  id: string;
  asset: string;
  x: number;
  y: number;
  speed: number;
  direction: 'down' | 'up' | 'left' | 'right';
  rotation: number;
  rotationSpeed: number;
}

let spawnCounter = 0;

export class Spawner extends BaseModule {
  readonly type = 'Spawner';

  private objects: SpawnedObject[] = [];
  private spawnTimer = 0;

  getSchema(): ModuleSchema {
    return {
      items: {
        type: 'asset[]',
        label: 'Items',
        default: [],
      },
      speed: {
        type: 'object',
        label: 'Speed',
        default: { min: 100, max: 200 },
        fields: {
          min: { type: 'number', label: 'Min', default: 100, min: 0 },
          max: { type: 'number', label: 'Max', default: 200, min: 0 },
        },
      },
      frequency: {
        type: 'range',
        label: 'Frequency (s)',
        default: 1.5,
        min: 0.3,
        max: 5,
        step: 0.1,
        unit: 's',
      },
      spawnArea: {
        type: 'rect',
        label: 'Spawn Area',
        default: { x: 0, y: 0, width: 800, height: 0 },
      },
      direction: {
        type: 'select',
        label: 'Direction',
        default: 'down',
        options: ['down', 'up', 'left', 'right', 'random'],
      },
      maxCount: {
        type: 'number',
        label: 'Max Count',
        default: 10,
        min: 1,
        max: 50,
      },
      rotation: {
        type: 'boolean',
        label: 'Rotation',
        default: false,
      },
      rotationSpeed: {
        type: 'range',
        label: 'Rotation Speed',
        default: 0,
        min: 0,
        max: 10,
        step: 0.1,
      },
      spriteSize: {
        type: 'range',
        label: '素材大小',
        default: 48,
        min: 16,
        max: 128,
        step: 4,
        unit: 'px',
      },
    };
  }

  getContracts(): ModuleContracts {
    const spriteSize = (this.params.spriteSize as number) ?? 48;
    const itemConfigs: Array<{ asset: string; layer?: string }> = this.params.items ?? [];
    // Default layer from first item, but getLayerForObject provides per-asset routing
    const defaultLayer = itemConfigs.find((i) => i.layer)?.layer ?? 'items';

    // Build asset→layer lookup for per-item routing (runner: coins→items, obstacles→obstacles)
    const assetLayerMap = new Map<string, string>();
    for (const item of itemConfigs) {
      if (item.layer) assetLayerMap.set(item.asset, item.layer);
    }

    return {
      collisionProvider: {
        layer: defaultLayer,
        radius: spriteSize / 2,
        spawnEvent: 'spawner:created',
        destroyEvent: 'spawner:destroyed',
        getActiveObjects: () =>
          this.objects.map((o) => ({ id: o.id, x: o.x, y: o.y })),
        getLayerForObject: (data) =>
          (data.asset ? assetLayerMap.get(data.asset) : undefined) ?? defaultLayer,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('collision:hit', (data?: any) => {
      if (data?.targetId) {
        this.removeObject(data.targetId);
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const frequency = (this.params.frequency ?? 1.5) * 1000; // convert to ms

    // Advance spawn timer
    this.spawnTimer += dt;

    // Spawn if timer exceeds frequency and under maxCount
    if (this.spawnTimer >= frequency && this.objects.length < (this.params.maxCount ?? 10)) {
      this.spawn();
      this.spawnTimer -= frequency;
    }

    // Move existing objects
    const canvas = this.engine?.getCanvas() ?? { width: 800, height: 600 };
    const toRemove: string[] = [];

    for (const obj of this.objects) {
      const displacement = obj.speed * (dt / 1000);

      switch (obj.direction) {
        case 'down':
          obj.y += displacement;
          break;
        case 'up':
          obj.y -= displacement;
          break;
        case 'left':
          obj.x -= displacement;
          break;
        case 'right':
          obj.x += displacement;
          break;
      }

      if (this.params.rotation) {
        obj.rotation += obj.rotationSpeed * (dt / 1000);
      }

      // Check out-of-bounds
      if (
        obj.x < -100 ||
        obj.x > canvas.width + 100 ||
        obj.y < -100 ||
        obj.y > canvas.height + 100
      ) {
        toRemove.push(obj.id);
      }
    }

    // Remove out-of-bounds objects
    for (const id of toRemove) {
      this.removeObjectInternal(id);
      this.emit('spawner:destroyed', { id });
    }
  }

  spawn(): SpawnedObject | null {
    const items: Array<{ asset: string; weight: number }> = this.params.items ?? [];
    if (items.length === 0) return null;

    // Weighted random pick
    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    let picked = items[0];
    for (const item of items) {
      roll -= item.weight ?? 1;
      if (roll <= 0) {
        picked = item;
        break;
      }
    }

    const area = this.params.spawnArea ?? { x: 0, y: 0, width: 800, height: 0 };
    const speed = this.params.speed ?? { min: 100, max: 200 };

    const directions: Array<'down' | 'up' | 'left' | 'right'> = ['down', 'up', 'left', 'right'];
    const direction =
      this.params.direction === 'random'
        ? directions[Math.floor(Math.random() * directions.length)]
        : (this.params.direction ?? 'down');

    // Clamp speed range: ensure min <= max
    const speedMin = Math.max(0, speed.min ?? 100);
    const speedMax = Math.max(speedMin, speed.max ?? 200);

    const obj: SpawnedObject = {
      id: `spawn-${++spawnCounter}`,
      asset: picked.asset,
      x: area.x + Math.random() * (area.width ?? 0),
      y: area.y + Math.random() * (area.height ?? 0),
      speed: speedMin + Math.random() * (speedMax - speedMin),
      direction,
      rotation: 0,
      rotationSpeed: this.params.rotation ? (this.params.rotationSpeed ?? 0) : 0,
    };

    this.objects.push(obj);
    this.emit('spawner:created', { id: obj.id, asset: obj.asset, x: obj.x, y: obj.y });
    return obj;
  }

  getObjects(): SpawnedObject[] {
    return [...this.objects];
  }

  removeObject(id: string): void {
    const existed = this.objects.some((o) => o.id === id);
    this.removeObjectInternal(id);
    if (existed) {
      this.emit('spawner:destroyed', { id });
    }
  }

  private removeObjectInternal(id: string): void {
    const index = this.objects.findIndex((o) => o.id === id);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  reset(): void {
    this.objects = [];
    this.spawnTimer = 0;
  }
}
