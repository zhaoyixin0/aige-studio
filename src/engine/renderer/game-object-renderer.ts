import { Container, Graphics, Text, TextStyle, Sprite, Texture } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Spawner } from '@/engine/modules/mechanic/spawner';
import type { FaceInput } from '@/engine/modules/input/face-input';
import type { HandInput } from '@/engine/modules/input/hand-input';
import type { TouchInput } from '@/engine/modules/input/touch-input';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import type { Jump } from '@/engine/modules/mechanic/jump';
import type { StaticPlatform } from '@/engine/modules/mechanic/static-platform';
import type { MovingPlatform } from '@/engine/modules/mechanic/moving-platform';
import type { CrumblingPlatform } from '@/engine/modules/mechanic/crumbling-platform';
import type { Collectible } from '@/engine/modules/mechanic/collectible';
import type { Hazard } from '@/engine/modules/mechanic/hazard';
import type { Checkpoint } from '@/engine/modules/mechanic/checkpoint';
import type { CameraFollow } from '@/engine/modules/feedback/camera-follow';
import type { Runner } from '@/engine/modules/mechanic/runner';
import { assetToEmoji, getTheme } from './theme-registry';

export class GameObjectRenderer {
  private container: Container;
  private sprites = new Map<string, Container>();
  private textureCache = new Map<string, Texture>();
  private playerSprite: Container | null = null;
  private lastAssetsRef: Record<string, any> | null = null;
  private platformGraphics: Graphics | null = null;
  /** IFrames visual flicker state */
  private iframesActive = false;
  private iframesStartTime = 0;
  /** Pending tween offsets applied during sync() */
  private tweenOffsets = new Map<string, Partial<Record<string, number>>>();
  /** Physics2D body position overrides */
  private physicsPositions = new Map<string, { x: number; y: number }>();
  /** Streaming hot-swap support: spriteId → asset key (so applyAssetUpdate can find targets). */
  private spriteAssetKeys = new Map<string, string>();
  /** Streaming hot-swap support: asset key → last known src (so we can invalidate stale cache entries). */
  private assetKeyToSrc = new Map<string, string>();
  /** Streaming hot-swap support: asset key currently bound to the player sprite. */
  private playerAssetKey: string | null = null;
  /** Default sprite size used by hot-swap when a sprite is rebuilt. Updated by sync() as spawners are processed. */
  private lastSpriteSize = 48;
  /** Default player size used by hot-swap. Updated by player sync paths. */
  private lastPlayerSize = 64;

  constructor(container: Container) {
    this.container = container;
  }

  destroy(): void {
    this.tweenOffsets.clear();
    this.physicsPositions.clear();
    this.spriteAssetKeys.clear();
    this.assetKeyToSrc.clear();
    this.playerAssetKey = null;
    for (const tex of this.textureCache.values()) {
      tex.destroy(true);
    }
    this.textureCache.clear();
    for (const sprite of this.sprites.values()) {
      sprite.destroy({ children: true });
    }
    this.sprites.clear();
    if (this.playerSprite) {
      this.playerSprite.destroy({ children: true });
      this.playerSprite = null;
    }
    this.platformGraphics?.destroy();
    this.platformGraphics = null;
    this.lastAssetsRef = null;
  }

  /** Wire iframes events using pixi-renderer's tracked listener helper */
  wireIFramesEvents(listen: (event: string, handler: (data?: any) => void) => void): void {
    listen('iframes:start', () => { this.iframesActive = true; this.iframesStartTime = performance.now(); });
    listen('iframes:end', () => { this.iframesActive = false; });
  }

  /** Store pending tween offsets for an entity. Returns false if entity sprite not found. */
  applyTweenUpdate(entityId: string, properties: Record<string, number>): boolean {
    const sprite = this.sprites.get(entityId) ?? (entityId === 'player_1' ? this.playerSprite : null);
    if (!sprite) return false;
    this.tweenOffsets.set(entityId, { ...this.tweenOffsets.get(entityId), ...properties });
    return true;
  }

  /** Remove all tween offsets for an entity. */
  clearTweenOffset(entityId: string): void {
    this.tweenOffsets.delete(entityId);
  }

  /** Store physics body position override for an entity. Returns false if sprite not found. */
  applyPhysicsPosition(entityId: string, x: number, y: number): boolean {
    const sprite = this.sprites.get(entityId) ?? (entityId === 'player_1' ? this.playerSprite : null);
    if (!sprite) return false;
    this.physicsPositions.set(entityId, { x, y });
    return true;
  }

  /** Remove physics position override for an entity. */
  clearPhysicsPosition(entityId: string): void {
    this.physicsPositions.delete(entityId);
  }

  sync(engine: Engine): void {
    // Detect asset changes via reference equality (O(1) — Zustand produces new objects on mutation)
    const assets = engine.getConfig().assets ?? {};
    if (assets !== this.lastAssetsRef) {
      if (this.lastAssetsRef !== null) {
        // Assets changed since last frame — clear cached sprites and textures
        for (const sprite of this.sprites.values()) {
          this.container.removeChild(sprite);
          sprite.destroy();
        }
        this.sprites.clear();
        this.spriteAssetKeys.clear();
        this.assetKeyToSrc.clear();
        this.playerAssetKey = null;
        if (this.playerSprite) {
          this.container.removeChild(this.playerSprite);
          this.playerSprite.destroy();
          this.playerSprite = null;
        }
        // Clear texture cache so new asset images are loaded fresh
        for (const tex of this.textureCache.values()) {
          tex.destroy();
        }
        this.textureCache.clear();
      }
      this.lastAssetsRef = assets;
    }

    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    const state = gameFlow?.getState() ?? 'playing';

    // Route rendering by game pattern
    const playerMovement = engine.getModulesByType('PlayerMovement')[0] as PlayerMovement | undefined;
    const hasPlatforms = engine.getModulesByType('StaticPlatform').length > 0
      || engine.getModulesByType('MovingPlatform').length > 0;
    const hasSpawner = engine.getModulesByType('Spawner').length > 0;

    if (playerMovement && hasPlatforms) {
      // Platformer path: platforms, collectibles, hazards, camera follow
      this.container.visible = true;
      this.syncPlatformerScene(engine, playerMovement);
    } else if (playerMovement && hasSpawner) {
      // Catch/dodge/tap path: spawned objects + player from PlayerMovement
      this.container.visible = (state === 'playing' || state === 'finished');
      if (!this.container.visible) return;
      this.syncSpawnedObjects(engine);
      this.syncShooterPlayer(engine, playerMovement);
    } else if (playerMovement) {
      // Shooter/RPG path: player rendered from PlayerMovement position, no spawner
      this.container.visible = (state === 'playing' || state === 'finished');
      if (!this.container.visible) return;
      this.syncShooterPlayer(engine, playerMovement);
    } else {
      // Spawner-only path: runner or legacy
      this.container.visible = (state === 'playing' || state === 'finished');
      if (!this.container.visible) return;
      this.syncSpawnedObjects(engine);
      this.syncPlayer(engine);
    }

    // Apply tween offsets on top of base positions (once per frame)
    this.applyTweenOffsets();
  }

  private applyTweenOffsets(): void {
    for (const [id, offsets] of this.tweenOffsets) {
      const sprite = this.sprites.get(id) ?? (id === 'player_1' ? this.playerSprite : null);
      if (!sprite) continue;
      if (offsets.x != null) sprite.x += offsets.x;           // additive
      if (offsets.y != null) sprite.y += offsets.y;           // additive
      if (offsets.scaleX != null) sprite.scale.x = offsets.scaleX; // absolute
      if (offsets.scaleY != null) sprite.scale.y = offsets.scaleY; // absolute
      if (offsets.rotation != null) sprite.rotation = offsets.rotation; // absolute
      if (offsets.alpha != null) sprite.alpha = offsets.alpha;         // absolute
    }
  }

  private syncSpawnedObjects(engine: Engine): void {
    const spawners = engine.getModulesByType('Spawner');
    const activeIds = new Set<string>();

    const themeName = engine.getConfig().meta.theme ?? 'fruit';
    const theme = getTheme(themeName);

    const configAssets = engine.getConfig().assets ?? {};

    for (const spawner of spawners) {
      const spriteSize = (spawner as Spawner).getParams().spriteSize as number ?? 48;
      this.lastSpriteSize = spriteSize;
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
            this.assetKeyToSrc.set(obj.asset, assetEntry.src);
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
          this.spriteAssetKeys.set(obj.id, obj.asset);
        }
        // Physics2D position override (if body exists), else use Spawner position
        const physPos = this.physicsPositions.get(obj.id);
        if (physPos) {
          wrapper.x = physPos.x;
          wrapper.y = physPos.y;
        } else {
          wrapper.x = obj.x;
          wrapper.y = obj.y;
        }
        wrapper.rotation = obj.rotation ?? 0;
      }
    }

    // Clean up destroyed objects
    for (const [id, sprite] of this.sprites) {
      if (!activeIds.has(id)) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(id);
        this.tweenOffsets.delete(id);
        this.physicsPositions.delete(id);
        this.spriteAssetKeys.delete(id);
      }
    }
  }

  private syncPlayer(engine: Engine): void {
    const spawner = engine.getModulesByType('Spawner')[0] as Spawner | undefined;
    if (!spawner) return;

    const speedParam = spawner.getParams().speed as { max?: number } | undefined;
    const isTapStyle = speedParam?.max === 0;

    // Try FaceInput, HandInput, then TouchInput
    const faceInput = engine.getModulesByType('FaceInput')[0] as FaceInput | undefined;
    const handInput = engine.getModulesByType('HandInput')[0] as HandInput | undefined;
    const touchInput = engine.getModulesByType('TouchInput')[0] as TouchInput | undefined;

    let pos: { x: number; y: number } | null = null;

    // Runner games: compute position from lane
    const runner = engine.getModulesByType('Runner')[0] as Runner | undefined;
    if (runner && runner.isStarted()) {
      const laneCount = (runner.getParams().laneCount as number) ?? 3;
      const lane = runner.getCurrentLane();
      const canvas = engine.getCanvas();
      const laneWidth = canvas.width / laneCount;
      pos = { x: laneWidth * (lane + 0.5), y: canvas.height * 0.8 };
    } else if (faceInput) {
      pos = faceInput.getPosition();
    } else if (handInput) {
      pos = handInput.getPosition();
    } else if (touchInput) {
      pos = touchInput.getPosition();
      if (pos && !isTapStyle) {
        // Catch/dodge: lock player to bottom of screen
        const canvas = engine.getCanvas();
        pos = { x: pos.x, y: canvas.height * 0.85 };
      }
    }

    if (pos) {

      // Read playerSize from input module params
      const inputMod = (faceInput ?? handInput ?? touchInput) as { getParams: () => Record<string, unknown> } | undefined;
      const playerSize = (inputMod?.getParams()?.playerSize as number) ?? 64;
      this.lastPlayerSize = playerSize;

      if (!this.playerSprite) {
        const configAssets = engine.getConfig().assets ?? {};
        const playerAsset = configAssets['player'];
        const hasPlayerImage = playerAsset?.src?.startsWith('data:');
        this.playerAssetKey = 'player';

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
          this.assetKeyToSrc.set('player', playerAsset.src);
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
      }
      this.playerSprite.x = pos.x;
      this.playerSprite.y = pos.y;

      // Dynamic scale based on current playerSize (allows real-time slider adjustment)
      const baseSize = 64; // default creation size
      const scale = playerSize / baseSize;
      this.playerSprite.scale.set(scale);
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

  // ── Shooter/RPG player rendering ──────────────────────────────────

  private syncShooterPlayer(engine: Engine, playerMovement: PlayerMovement): void {
    const px = playerMovement.getX();
    const py = playerMovement.getY();
    const touchInput = engine.getModulesByType('TouchInput')[0] as TouchInput | undefined;
    const playerSize = (touchInput?.getParams()?.playerSize as number) ?? 64;
    this.lastPlayerSize = playerSize;

    if (!this.playerSprite) {
      const playerContainer = new Container();
      const configAssets = engine.getConfig().assets ?? {};
      const playerAsset = configAssets['player'];
      const hasPlayerImage = playerAsset?.src?.startsWith('data:');
      this.playerAssetKey = 'player';

      if (hasPlayerImage) {
        const shadow = new Graphics();
        shadow.ellipse(0, playerSize * 0.3, playerSize * 0.4, 8).fill({ color: 0x000000, alpha: 0.3 });
        playerContainer.addChild(shadow);
        const imgSprite = this.createSpriteFromDataUrl(playerAsset.src, playerSize);
        playerContainer.addChild(imgSprite);
        this.assetKeyToSrc.set('player', playerAsset.src);
      } else {
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
      }
      this.container.addChild(playerContainer);
      this.playerSprite = playerContainer;
    }
    this.playerSprite.x = px;
    this.playerSprite.y = py;

    // IFrames visual feedback: alpha flicker every 100ms
    if (this.iframesActive) {
      const elapsed = performance.now() - this.iframesStartTime;
      this.playerSprite.alpha = Math.floor(elapsed / 100) % 2 === 0 ? 0.3 : 1.0;
    } else {
      this.playerSprite.alpha = 1.0;
    }
  }

  // ── Platformer rendering ──────────────────────────────────────────

  private syncPlatformerScene(engine: Engine, playerMovement: PlayerMovement): void {
    const canvas = engine.getCanvas();
    // Resolve all modules once per frame
    const jump = engine.getModulesByType('Jump')[0] as Jump | undefined;
    const camera = engine.getModulesByType('CameraFollow')[0] as CameraFollow | undefined;
    const staticPlat = engine.getModulesByType('StaticPlatform')[0] as StaticPlatform | undefined;
    const movingPlat = engine.getModulesByType('MovingPlatform')[0] as MovingPlatform | undefined;
    const crumblingPlat = engine.getModulesByType('CrumblingPlatform')[0] as CrumblingPlatform | undefined;
    const collectible = engine.getModulesByType('Collectible')[0] as Collectible | undefined;
    const hazard = engine.getModulesByType('Hazard')[0] as Hazard | undefined;
    const checkpoint = engine.getModulesByType('Checkpoint')[0] as Checkpoint | undefined;
    const touchInput = engine.getModulesByType('TouchInput')[0] as TouchInput | undefined;

    // Camera: if camera is active and tracking, use its offset.
    // Otherwise render at raw coordinates (no offset) for edit mode.
    const camPos = camera?.getPosition() ?? null;
    const hasCameraTracking = camPos && (camPos.x !== 0 || camPos.y !== 0);
    const camOffsetX = hasCameraTracking ? canvas.width / 2 - camPos.x : 0;
    const camOffsetY = hasCameraTracking ? canvas.height / 2 - camPos.y : 0;

    if (!this.platformGraphics) {
      this.platformGraphics = new Graphics();
      this.container.addChild(this.platformGraphics);
    }
    this.platformGraphics.clear();

    this.drawPlatforms(staticPlat, movingPlat, crumblingPlat, this.platformGraphics, camOffsetX, camOffsetY);
    this.drawCollectibles(collectible, this.platformGraphics, camOffsetX, camOffsetY);
    this.drawHazards(hazard, this.platformGraphics, camOffsetX, camOffsetY);
    this.drawCheckpoints(checkpoint, this.platformGraphics, camOffsetX, camOffsetY);

    // Player position
    const px = playerMovement.getX();
    const py = jump ? jump.getY() * canvas.height : canvas.height * 0.8;
    const playerSize = (touchInput?.getParams()?.playerSize as number) ?? 48;
    this.lastPlayerSize = playerSize;
    const screenX = px + camOffsetX;
    const screenY = py + camOffsetY;

    if (!this.playerSprite) {
      const playerContainer = new Container();
      const themeName = engine.getConfig().meta.theme ?? 'fruit';
      const theme = getTheme(themeName);
      const configAssets = engine.getConfig().assets ?? {};
      const playerAsset = configAssets['player'];
      const hasPlayerImage = playerAsset?.src?.startsWith('data:');
      this.playerAssetKey = 'player';

      if (hasPlayerImage) {
        const imgSprite = this.createSpriteFromDataUrl(playerAsset.src, playerSize);
        playerContainer.addChild(imgSprite);
        this.assetKeyToSrc.set('player', playerAsset.src);
      } else {
        const emojiText = new Text({
          text: theme.playerEmoji,
          style: new TextStyle({ fontSize: playerSize }),
        });
        emojiText.anchor.set(0.5);
        playerContainer.addChild(emojiText);
      }
      this.container.addChild(playerContainer);
      this.playerSprite = playerContainer;
    }
    this.playerSprite.x = screenX;
    this.playerSprite.y = screenY;

    // IFrames visual feedback: alpha flicker every 100ms
    if (this.iframesActive) {
      const elapsed = performance.now() - this.iframesStartTime;
      this.playerSprite.alpha = Math.floor(elapsed / 100) % 2 === 0 ? 0.3 : 1.0;
    } else {
      this.playerSprite.alpha = 1.0;
    }

    collectible?.checkCollision(px, py, playerSize / 2);
    hazard?.checkCollision(px, py);
  }

  private drawPlatforms(
    staticPlatform: StaticPlatform | undefined,
    movingPlatform: MovingPlatform | undefined,
    crumblingPlatform: CrumblingPlatform | undefined,
    g: Graphics, cx: number, cy: number,
  ): void {
    if (staticPlatform) {
      for (const p of staticPlatform.getPlatforms()) {
        const color = p.material === 'ice' ? 0x88ccff : p.material === 'sticky' ? 0xcc8844 : 0x44aa44;
        g.rect(p.x + cx, p.y + cy, p.width, p.height).fill({ color, alpha: 0.9 });
        g.rect(p.x + cx, p.y + cy, p.width, 4).fill({ color: 0x66cc66 });
      }
    }

    if (movingPlatform) {
      for (const p of movingPlatform.getPlatformPositions()) {
        g.rect(p.x + cx, p.y + cy, p.width, p.height).fill({ color: 0x4488cc, alpha: 0.9 });
        g.rect(p.x + cx, p.y + cy, p.width, 4).fill({ color: 0x66aaee });
      }
    }

    if (crumblingPlatform) {
      const platforms = crumblingPlatform.getPlatforms() as Array<{ x: number; y: number; width: number; height: number }>;
      for (let i = 0; i < platforms.length; i++) {
        if (!crumblingPlatform.isPlatformActive(i)) continue;
        const p = platforms[i];
        g.rect(p.x + cx, p.y + cy, p.width, p.height).fill({ color: 0xcc8844, alpha: 0.7 });
        // Crack pattern to indicate fragility
        g.rect(p.x + cx + p.width * 0.3, p.y + cy, 2, p.height).fill({ color: 0x996633, alpha: 0.5 });
        g.rect(p.x + cx + p.width * 0.7, p.y + cy, 2, p.height).fill({ color: 0x996633, alpha: 0.5 });
      }
    }
  }

  private drawCollectibles(collectible: Collectible | undefined, g: Graphics, cx: number, cy: number): void {
    if (!collectible) return;

    const positions = collectible.getItemPositions();
    for (const item of positions) {
      const x = item.x + cx;
      const y = item.displayY + cy;
      // Gold coin circle
      g.circle(x, y, 10).fill({ color: 0xffd700 });
      g.circle(x, y, 7).fill({ color: 0xffec80 });
    }
  }

  private drawHazards(hazard: Hazard | undefined, g: Graphics, cx: number, cy: number): void {
    if (!hazard) return;

    for (const h of hazard.getHazardPositions()) {
      const x = h.x + cx;
      const y = h.y + cy;
      // Red danger zone
      g.rect(x, y, h.width, h.height).fill({ color: 0xff4444, alpha: 0.8 });
      // Spike triangles on top
      const spikeCount = Math.max(1, Math.floor(h.width / 12));
      const spikeW = h.width / spikeCount;
      for (let i = 0; i < spikeCount; i++) {
        const sx = x + i * spikeW;
        g.moveTo(sx, y).lineTo(sx + spikeW / 2, y - 8).lineTo(sx + spikeW, y).fill({ color: 0xff6666 });
      }
    }
  }

  private drawCheckpoints(checkpoint: Checkpoint | undefined, g: Graphics, cx: number, cy: number): void {
    if (!checkpoint) return;

    const checkpoints = checkpoint.getCheckpoints();
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const activated = checkpoint.isActivated(i);
      const color = activated ? 0x00ff88 : 0x888888;
      // Flag pole
      g.rect(cp.x + cx, cp.y + cy, 4, cp.height).fill({ color });
      // Flag triangle
      g.moveTo(cp.x + cx + 4, cp.y + cy)
        .lineTo(cp.x + cx + 20, cp.y + cy + 10)
        .lineTo(cp.x + cx + 4, cp.y + cy + 20)
        .fill({ color, alpha: 0.8 });
    }
  }

  reset(): void {
    this.iframesActive = false;
    this.iframesStartTime = 0;
    this.tweenOffsets.clear();
    this.physicsPositions.clear();
    this.spriteAssetKeys.clear();
    this.assetKeyToSrc.clear();
    this.playerAssetKey = null;
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
    if (this.platformGraphics) {
      this.container.removeChild(this.platformGraphics);
      this.platformGraphics.destroy();
      this.platformGraphics = null;
    }
    // Clear texture cache so new assets are loaded fresh on re-init
    for (const tex of this.textureCache.values()) {
      tex.destroy();
    }
    this.textureCache.clear();
    this.lastAssetsRef = null;
  }

  /**
   * Hot-swap an asset's texture in all live sprites that reference this key.
   * Called when streaming asset fulfillment delivers a new sprite mid-game,
   * so users see the new image without waiting for a full engine reload.
   *
   * Preserves container x/y/rotation — only the inner child sprite is rebuilt.
   */
  applyAssetUpdate(key: string, src: string): void {
    // 1. Invalidate any cached texture for the previous src of this key.
    const prevSrc = this.assetKeyToSrc.get(key);
    if (prevSrc && prevSrc !== src) {
      const cachedTexture = this.textureCache.get(prevSrc);
      if (cachedTexture) {
        try {
          cachedTexture.destroy();
        } catch {
          // Already destroyed or test mock — ignore
        }
        this.textureCache.delete(prevSrc);
      }
    }

    // 2. Iterate all live spawned sprites and rebuild those matching the key.
    for (const [spriteId, wrapper] of this.sprites) {
      if (this.spriteAssetKeys.get(spriteId) !== key) continue;
      this.rebuildWrapperChild(wrapper, src, this.lastSpriteSize);
    }

    // 3. Swap player sprite if it is bound to this key.
    if (this.playerSprite && this.playerAssetKey === key) {
      this.rebuildWrapperChild(this.playerSprite, src, this.lastPlayerSize);
    }

    // 4. Remember the new src so future updates can invalidate correctly.
    this.assetKeyToSrc.set(key, src);
  }

  /**
   * Replace the first child of a wrapper container with a newly-built image
   * sprite from the given data URL. Does NOT touch wrapper.x/y/rotation/scale.
   */
  private rebuildWrapperChild(wrapper: Container, src: string, size: number): void {
    // Remove and destroy ALL existing children (emoji Text, old Sprite, old shadow).
    // The first child that matches is typically the image/emoji; keeping shadows
    // would be a nice-to-have but we prioritize correctness over ornamentation.
    while (wrapper.children.length > 0) {
      const child = wrapper.children[0];
      wrapper.removeChild(child);
      try {
        child.destroy({ children: true });
      } catch {
        // Best-effort cleanup — ignore if already destroyed
      }
    }
    const newChild = this.createSpriteFromDataUrl(src, size);
    wrapper.addChild(newChild);
  }
}
