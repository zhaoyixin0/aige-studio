import { Container, Graphics, Text, TextStyle, Sprite, Texture, Assets } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { FaceInput } from '@/engine/modules/input/face-input';
import type { HandInput } from '@/engine/modules/input/hand-input';
import type { TouchInput } from '@/engine/modules/input/touch-input';
import type { Collision } from '@/engine/modules/mechanic/collision';
import { assetToEmoji, getTheme } from './theme-registry';

export class GameObjectRenderer {
  private container: Container;
  private sprites = new Map<string, Container>();
  private textureCache = new Map<string, Texture>();
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

    const configAssets = engine.getConfig().assets ?? {};

    for (const spawner of spawners) {
      const spriteSize = (spawner as Spawner).getParams().spriteSize as number ?? 48;
      const objects = (spawner as Spawner).getObjects();
      for (const obj of objects) {
        activeIds.add(obj.id);
        let wrapper = this.sprites.get(obj.id);
        if (!wrapper) {
          wrapper = new Container();
          const assetEntry = configAssets[obj.asset];
          const hasRealImage = assetEntry?.src?.startsWith('data:');

          if (hasRealImage) {
            // Use real image sprite
            const sprite = this.createSpriteFromDataUrl(assetEntry.src, spriteSize);
            wrapper.addChild(sprite);
          } else {
            // Fallback to emoji, scale font size proportionally
            const emoji = assetToEmoji(obj.asset, theme);
            const text = new Text({
              text: emoji,
              style: new TextStyle({ fontSize: Math.round(spriteSize * 0.6) }),
            });
            text.anchor.set(0.5);
            wrapper.addChild(text);
          }
          this.container.addChild(wrapper);
          this.sprites.set(obj.id, wrapper);
        }
        wrapper.x = obj.x;
        wrapper.y = obj.y;
        wrapper.rotation = obj.rotation ?? 0;

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

      // Read playerSize from input module params
      const inputMod = (faceInput ?? handInput ?? touchInput) as { getParams: () => Record<string, unknown> } | undefined;
      const playerSize = (inputMod?.getParams()?.playerSize as number) ?? 64;
      const playerRadius = isTapStyle ? 30 : playerSize / 2;

      if (!this.playerSprite) {
        const configAssets = engine.getConfig().assets ?? {};
        const playerAsset = configAssets['player'];
        const hasPlayerImage = playerAsset?.src?.startsWith('data:');

        if (isTapStyle) {
          // Crosshair style for tap games
          const crosshair = new Graphics();
          crosshair.circle(0, 0, 25).stroke({ color: 0x00ff88, width: 3 });
          crosshair.moveTo(-15, 0).lineTo(15, 0).stroke({ color: 0x00ff88, width: 2 });
          crosshair.moveTo(0, -15).lineTo(0, 15).stroke({ color: 0x00ff88, width: 2 });
          this.playerSprite = crosshair;
        } else if (hasPlayerImage) {
          // AI-generated player image
          const playerContainer = new Container();
          const shadow = new Graphics();
          shadow.ellipse(0, playerSize * 0.3, playerSize * 0.4, 8).fill({ color: 0x000000, alpha: 0.3 });
          playerContainer.addChild(shadow);
          const imgSprite = this.createSpriteFromDataUrl(playerAsset.src, playerSize);
          playerContainer.addChild(imgSprite);
          this.playerSprite = playerContainer;
        } else {
          // Emoji player with shadow
          const playerContainer = new Container();
          const shadow = new Graphics();
          shadow.ellipse(0, playerSize * 0.3, playerSize * 0.4, 8).fill({ color: 0x000000, alpha: 0.3 });
          playerContainer.addChild(shadow);
          const themeName = engine.getConfig().meta.theme ?? 'fruit';
          const theme = getTheme(themeName);
          const emojiText = new Text({
            text: theme.playerEmoji,
            style: new TextStyle({ fontSize: playerSize }),
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

      // Dynamic scale based on current playerSize (allows real-time slider adjustment)
      const baseSize = 64; // default creation size
      const scale = playerSize / baseSize;
      this.playerSprite.scale.set(scale);

      // Sync collision position + radius
      const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
      if (collision) {
        collision.updateObject('player_1', pos);
      }
    }
  }

  private createSpriteFromDataUrl(dataUrl: string, size: number): Container {
    // Use a placeholder container; load image async and replace when ready
    const wrapper = new Container();

    const cached = this.textureCache.get(dataUrl);
    if (cached) {
      const sprite = new Sprite(cached);
      sprite.anchor.set(0.5);
      sprite.width = size;
      sprite.height = size;
      wrapper.addChild(sprite);
      return wrapper;
    }

    // Draw data URL onto a small canvas to avoid WebGL OOM
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const texture = Texture.from(canvas);
      this.textureCache.set(dataUrl, texture);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = size;
      sprite.height = size;
      wrapper.addChild(sprite);
    };
    img.src = dataUrl;

    return wrapper;
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
