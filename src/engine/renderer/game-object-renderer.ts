import { Container, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { FaceInput } from '@/engine/modules/input/face-input';
import type { HandInput } from '@/engine/modules/input/hand-input';
import type { Collision } from '@/engine/modules/mechanic/collision';

export class GameObjectRenderer {
  private container: Container;
  private sprites = new Map<string, Graphics>();
  private playerSprite: Graphics | null = null;

  constructor(container: Container) {
    this.container = container;
  }

  sync(engine: Engine): void {
    this.syncSpawnedObjects(engine);
    this.syncPlayer(engine);
  }

  private syncSpawnedObjects(engine: Engine): void {
    const spawners = engine.getModulesByType('Spawner');
    const activeIds = new Set<string>();

    for (const spawner of spawners) {
      const objects = (spawner as Spawner).getObjects();
      for (const obj of objects) {
        activeIds.add(obj.id);
        let sprite = this.sprites.get(obj.id);
        if (!sprite) {
          sprite = new Graphics();
          sprite.circle(0, 0, 20).fill({ color: this.getColorForAsset(obj.asset) });
          this.container.addChild(sprite);
          this.sprites.set(obj.id, sprite);
        }
        sprite.x = obj.x;
        sprite.y = obj.y;
        sprite.rotation = obj.rotation ?? 0;
      }
    }

    // Clean up destroyed objects
    for (const [id, sprite] of this.sprites) {
      if (!activeIds.has(id)) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private syncPlayer(engine: Engine): void {
    // Try FaceInput first, then HandInput
    const faceInput = engine.getModulesByType('FaceInput')[0] as FaceInput | undefined;
    const handInput = engine.getModulesByType('HandInput')[0] as HandInput | undefined;
    const input = faceInput ?? handInput;

    if (input) {
      const pos = input.getPosition();
      if (pos) {
        if (!this.playerSprite) {
          this.playerSprite = new Graphics();
          this.playerSprite.circle(0, 0, 40).fill({ color: 0x00ff88 });
          this.container.addChild(this.playerSprite);
        }
        this.playerSprite.x = pos.x;
        this.playerSprite.y = pos.y;

        // Sync collision
        const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
        if (collision) {
          collision.updateObject('player_1', pos);
        }
      }
    }
  }

  private getColorForAsset(asset: string): number {
    // Simple hash-based color for different assets
    let hash = 0;
    for (const char of asset) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return (hash & 0x00ffffff) | 0x404040; // ensure not too dark
  }

  reset(): void {
    for (const sprite of this.sprites.values()) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    this.sprites.clear();
    if (this.playerSprite) {
      this.container.removeChild(this.playerSprite);
      this.playerSprite.destroy();
      this.playerSprite = null;
    }
  }
}
