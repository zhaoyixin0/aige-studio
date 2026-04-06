import { Container, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Collider2DConfig } from '@/engine/systems/physics2d/types';

const COLOR_DEFAULT = 0x00ff00;

export class PhysicsDebugRenderer {
  private g: Graphics;
  private enabled = false;
  private colliderDefs = new Map<string, readonly Collider2DConfig[]>();

  constructor(parent: Container) {
    this.g = new Graphics();
    this.g.visible = false;
    parent.addChild(this.g);
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this.g.visible = this.enabled;
  }

  addBody(entityId: string, colliders: readonly Collider2DConfig[]): void {
    this.colliderDefs.set(entityId, colliders);
  }

  removeBody(entityId: string): void {
    this.colliderDefs.delete(entityId);
  }

  /** Wire events using pixi-renderer's tracked listener helper */
  wire(listen: (event: string, handler: (data?: any) => void) => void): void {
    listen('physics2d:debug:toggle', () => { this.toggle(); });
    listen('physics2d:add-body', (data?: any) => {
      if (data?.entityId && Array.isArray(data?.colliders)) {
        this.addBody(data.entityId, data.colliders);
      }
    });
    listen('physics2d:remove-body', (data?: any) => {
      if (data?.entityId) {
        this.removeBody(data.entityId);
      }
    });
  }

  sync(engine: Engine): void {
    if (!this.enabled) return;
    const phys = engine.getModulesByType('Physics2D')[0] as any;
    if (!phys) return;

    this.g.clear();

    for (const [id, colliders] of this.colliderDefs) {
      const pos = phys.getBodyPosition(id);
      if (!pos) continue;
      for (const c of colliders) {
        this.drawCollider(pos.x, pos.y, c);
      }
    }
  }

  reset(): void {
    this.colliderDefs.clear();
    this.enabled = false;
    this.g.visible = false;
    this.g.clear();
  }

  destroy(): void {
    this.reset();
    this.g.destroy();
  }

  private drawCollider(x: number, y: number, c: Collider2DConfig): void {
    const color = COLOR_DEFAULT;
    const [ox, oy] = (c.shape as any).offset ?? [0, 0];

    switch (c.shape.kind) {
      case 'Circle':
        this.g.circle(x + ox, y + oy, c.shape.radius)
          .stroke({ color, width: 1, alpha: 0.7 });
        break;
      case 'Box':
        this.g.rect(
          x + ox - c.shape.width / 2,
          y + oy - c.shape.height / 2,
          c.shape.width,
          c.shape.height,
        ).stroke({ color, width: 1, alpha: 0.7 });
        break;
      case 'Edge': {
        const pts = c.shape.points;
        for (let i = 0; i < pts.length - 1; i++) {
          this.g.moveTo(x + pts[i][0], y + pts[i][1])
            .lineTo(x + pts[i + 1][0], y + pts[i + 1][1])
            .stroke({ color, width: 1, alpha: 0.7 });
        }
        break;
      }
    }
  }
}
