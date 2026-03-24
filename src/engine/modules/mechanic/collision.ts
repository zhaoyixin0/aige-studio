import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface CollisionObject {
  id: string;
  layer: string;
  x: number;
  y: number;
  radius: number;
}

interface CollisionRule {
  a: string;
  b: string;
  event: string;
  destroy?: string[];
}

export class Collision extends BaseModule {
  readonly type = 'Collision';

  private objects = new Map<string, CollisionObject>();

  getSchema(): ModuleSchema {
    return {
      rules: {
        type: 'collision-rules',
        label: 'Collision Rules',
        default: [],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
  }

  registerObject(
    id: string,
    layer: string,
    shape: { x: number; y: number; radius: number },
  ): void {
    this.objects.set(id, {
      id,
      layer,
      x: shape.x,
      y: shape.y,
      radius: shape.radius,
    });
  }

  updateObject(id: string, position: { x: number; y: number; radius?: number }): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    obj.x = position.x;
    obj.y = position.y;
    if (position.radius !== undefined) {
      obj.radius = position.radius;
    }
  }

  unregisterObject(id: string): void {
    this.objects.delete(id);
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;

    const rules: CollisionRule[] = this.params.rules ?? [];
    const toDestroy = new Set<string>();

    for (const rule of rules) {
      // Gather objects per layer
      const layerA: CollisionObject[] = [];
      const layerB: CollisionObject[] = [];

      for (const obj of this.objects.values()) {
        if (obj.layer === rule.a) layerA.push(obj);
        if (obj.layer === rule.b) layerB.push(obj);
      }

      // Check all pairs
      for (const objA of layerA) {
        for (const objB of layerB) {
          if (objA.id === objB.id) continue;
          if (toDestroy.has(objA.id) || toDestroy.has(objB.id)) continue;

          const dx = objA.x - objB.x;
          const dy = objA.y - objB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < objA.radius + objB.radius) {
            // Collision detected
            const midX = (objA.x + objB.x) / 2;
            const midY = (objA.y + objB.y) / 2;

            this.emit(`collision:${rule.event}`, {
              objectA: objA.id,
              objectB: objB.id,
              layerA: rule.a,
              layerB: rule.b,
              targetId: objB.id,
              x: midX,
              y: midY,
            });

            // Mark objects for destruction per rule.destroy config
            if (rule.destroy) {
              for (const side of rule.destroy) {
                if (side === 'a') toDestroy.add(objA.id);
                if (side === 'b') toDestroy.add(objB.id);
              }
            }
          }
        }
      }
    }

    // Remove destroyed objects
    for (const id of toDestroy) {
      this.objects.delete(id);
    }
  }

  reset(): void {
    this.objects.clear();
  }
}
