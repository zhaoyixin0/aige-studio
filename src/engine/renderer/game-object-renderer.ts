import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { FaceInput } from '@/engine/modules/input/face-input';
import type { HandInput } from '@/engine/modules/input/hand-input';
import type { TouchInput } from '@/engine/modules/input/touch-input';
import type { Collision } from '@/engine/modules/mechanic/collision';
import { assetToEmoji, getTheme } from './theme-registry';

export class GameObjectRenderer {
  private container: Container;
  private sprites = new Map<string, Text>();
  private playerSprite: Container | null = null;

  constructor(container: Container) {
    this.container = container;
  }

  sync(engine: Engine): void {
    this.syncSpawnedObjects(engine);
    this.syncPlayer(engine);
  }

  private syncSpawnedObjects(engine: Engine): void {
    const spawners = engine.getModulesByType('Spawner');
    const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
    const activeIds = new Set<string>();

    const themeName = engine.getConfig().meta.theme ?? 'fruit';
    const theme = getTheme(themeName);

    for (const spawner of spawners) {
      const objects = (spawner as Spawner).getObjects();
      for (const obj of objects) {
        activeIds.add(obj.id);
        let sprite = this.sprites.get(obj.id);
        if (!sprite) {
          const emoji = assetToEmoji(obj.asset, theme);
          sprite = new Text({
            text: emoji,
            style: new TextStyle({ fontSize: 28 }),
          });
          sprite.anchor.set(0.5);
          this.container.addChild(sprite);
          this.sprites.set(obj.id, sprite);
        }
        sprite.x = obj.x;
        sprite.y = obj.y;
        sprite.rotation = obj.rotation ?? 0;

        // Sync collision position for spawned objects
        if (collision) {
          collision.updateObject(obj.id, { x: obj.x, y: obj.y });
        }
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
    // Only show player character if there are spawned objects to interact with
    const hasSpawner = engine.getModulesByType('Spawner').length > 0;
    if (!hasSpawner) return;

    // Try FaceInput, HandInput, then TouchInput
    const faceInput = engine.getModulesByType('FaceInput')[0] as FaceInput | undefined;
    const handInput = engine.getModulesByType('HandInput')[0] as HandInput | undefined;
    const touchInput = engine.getModulesByType('TouchInput')[0] as TouchInput | undefined;

    let pos: { x: number; y: number } | null = null;

    if (faceInput) {
      pos = faceInput.getPosition();
    } else if (handInput) {
      pos = handInput.getPosition();
    } else if (touchInput) {
      pos = touchInput.getPosition();
      if (pos) {
        // Check if this is a catch game (has spawner with moving objects) or tap game (stationary objects)
        const spawner = engine.getModulesByType('Spawner')[0] as Spawner | undefined;
        const isTapGame = spawner && (spawner.getParams().speed?.max === 0 || spawner.getParams().speed?.min === 0 && spawner.getParams().speed?.max === 0);
        if (!isTapGame) {
          // Catch/dodge: lock player to bottom of screen
          const canvas = engine.getCanvas();
          pos = { x: pos.x, y: canvas.height * 0.85 };
        }
        // Tap game: player follows pointer exactly (acts as cursor)
      }
    }

    if (pos) {
      // Determine if tap game for different visual/collision
      const spawner = engine.getModulesByType('Spawner')[0] as Spawner | undefined;
      const isTapStyle = spawner && spawner.getParams().speed?.max === 0;
      const playerRadius = isTapStyle ? 30 : 40;

      if (!this.playerSprite) {
        if (isTapStyle) {
          // Crosshair style for tap games — keep as Graphics
          const crosshair = new Graphics();
          crosshair.circle(0, 0, 25).stroke({ color: 0x00ff88, width: 3 });
          crosshair.moveTo(-15, 0).lineTo(15, 0).stroke({ color: 0x00ff88, width: 2 });
          crosshair.moveTo(0, -15).lineTo(0, 15).stroke({ color: 0x00ff88, width: 2 });
          this.playerSprite = crosshair;
        } else {
          // Emoji player with shadow
          const playerContainer = new Container();

          // Shadow: small gray ellipse under the player
          const shadow = new Graphics();
          shadow.ellipse(0, 18, 22, 8).fill({ color: 0x000000, alpha: 0.3 });
          playerContainer.addChild(shadow);

          // Emoji text
          const themeName = engine.getConfig().meta.theme ?? 'fruit';
          const theme = getTheme(themeName);
          const emojiText = new Text({
            text: theme.playerEmoji,
            style: new TextStyle({ fontSize: 44 }),
          });
          emojiText.anchor.set(0.5);
          playerContainer.addChild(emojiText);

          this.playerSprite = playerContainer;
        }
        this.container.addChild(this.playerSprite);

        // Register player in collision system
        const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
        if (collision) {
          collision.registerObject('player_1', 'player', { x: pos.x, y: pos.y, radius: playerRadius });
        }
      }
      this.playerSprite.x = pos.x;
      this.playerSprite.y = pos.y;

      // Sync collision position
      const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
      if (collision) {
        collision.updateObject('player_1', pos);
      }
    }
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
