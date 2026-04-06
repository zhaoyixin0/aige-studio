import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import { GameObjectRenderer } from './game-object-renderer';
import { HudRenderer } from './hud-renderer';
import { ParticleRenderer } from './particle-renderer';
import { FloatTextRenderer } from './float-text-renderer';
import { SoundSynth } from './sound-synth';
import { ShooterRenderer } from './shooter-renderer';
import { RPGOverlayRenderer } from './rpg-overlay-renderer';
import { PhysicsDebugRenderer } from './physics-debug-renderer';
import { ParallaxRenderer } from './parallax-renderer';
import { getTheme, type GameTheme } from './theme-registry';

export class PixiRenderer {
  private app: Application;
  private cameraLayer = new Container();
  private gameLayer = new Container();
  private hudLayer = new Container();
  private backgroundGraphics: Graphics | null = null;
  private gameObjectRenderer: GameObjectRenderer | null = null;
  private hudRenderer: HudRenderer | null = null;
  private particleRenderer: ParticleRenderer | null = null;
  private floatTextRenderer: FloatTextRenderer | null = null;
  private soundSynth: SoundSynth | null = null;
  private shooterRenderer: ShooterRenderer | null = null;
  private rpgOverlayRenderer: RPGOverlayRenderer | null = null;
  private physicsDebugRenderer: PhysicsDebugRenderer | null = null;
  private parallaxRenderer: ParallaxRenderer | null = null;
  private initialized = false;
  private currentThemeId: string | null = null;
  private connectedEngine: Engine | null = null;
  private canvasClickHandler: (() => void) | null = null;
  private bgSprite: Sprite | null = null;
  private bgSrc: string | null = null;
  private engineEventHandlers: Array<{ event: string; handler: (data?: any) => void }> = [];

  // Juice: Screen Shake & Impact Flash
  private shakeAmount = 0;
  private shakeDuration = 0;
  private flashOverlay: Graphics | null = null;
  private flashAlpha = 0;

  constructor() {
    this.app = new Application();
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x111827,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.initialized = true;

    // Background goes behind everything
    this.backgroundGraphics = new Graphics();
    this.app.stage.addChild(this.backgroundGraphics);

    // Parallax layer between background and camera/game layers
    this.parallaxRenderer = new ParallaxRenderer(this.app.stage, width, height);

    this.app.stage.addChild(this.cameraLayer, this.gameLayer, this.hudLayer);

    // Impact flash overlay (top of everything except maybe HUD if we want)
    this.flashOverlay = new Graphics();
    this.flashOverlay.rect(0, 0, width, height).fill({ color: 0xFFFFFF });
    this.flashOverlay.alpha = 0;
    this.app.stage.addChild(this.flashOverlay);

    this.gameObjectRenderer = new GameObjectRenderer(this.gameLayer);
    this.shooterRenderer = new ShooterRenderer(this.gameLayer);
    this.rpgOverlayRenderer = new RPGOverlayRenderer(this.hudLayer, width, height);
    this.hudRenderer = new HudRenderer(this.hudLayer, width, height);
    this.particleRenderer = new ParticleRenderer(this.gameLayer);
    this.floatTextRenderer = new FloatTextRenderer(this.gameLayer);
    this.physicsDebugRenderer = new PhysicsDebugRenderer(this.gameLayer);

    // Draw default background
    this.drawBackground(getTheme('fruit'));
  }

  private drawBackground(theme: GameTheme): void {
    const bg = this.backgroundGraphics;
    if (!bg) return;

    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    bg.clear();

    // Solid fill with theme background color
    bg.rect(0, 0, w, h).fill({ color: theme.bg });

    // Grid lines — very subtle
    // Parse gridColor (rgba string) to a hex color + alpha
    const gridParsed = parseRgba(theme.gridColor);
    const gridColor = gridParsed.color;
    const gridAlpha = gridParsed.alpha;
    const gridSize = 40;

    // Vertical lines
    for (let x = gridSize; x < w; x += gridSize) {
      bg.moveTo(x, 0).lineTo(x, h).stroke({ color: gridColor, width: 1, alpha: gridAlpha });
    }

    // Horizontal lines
    for (let y = gridSize; y < h; y += gridSize) {
      bg.moveTo(0, y).lineTo(w, y).stroke({ color: gridColor, width: 1, alpha: gridAlpha });
    }
  }

  private syncBackgroundImage(engine: Engine): void {
    // Read from engine config first, then try store as fallback
    // (store may have assets updated by AssetAgent that haven't triggered engine reload yet)
    let bgAsset = engine.getConfig().assets?.background;
    if (!bgAsset?.src || !bgAsset.src.startsWith('data:')) {
      try {
        // Dynamic import from store to avoid circular dependency at module level
        const storeConfig = (window as any).__gameStore?.getState?.()?.config;
        if (storeConfig?.assets?.background?.src?.startsWith('data:')) {
          bgAsset = storeConfig.assets.background;
        }
      } catch { /* ignore */ }
    }
    const src = bgAsset?.src;

    if (!src || !src.startsWith('data:')) {
      // No AI background — use theme grid background
      if (this.bgSprite) {
        this.bgSprite.visible = false;
      }
      if (this.backgroundGraphics) {
        this.backgroundGraphics.visible = true;
      }
      return;
    }

    // Already rendered this src
    if (src === this.bgSrc && this.bgSprite) return;

    // Load new background image
    this.bgSrc = src;
    const capturedSrc = src;
    const img = new window.Image();
    img.onload = () => {
      // Guard against stale load if src changed while loading
      if (this.bgSrc !== capturedSrc) return;
      const canvas = document.createElement('canvas');
      const w = this.app.renderer.width;
      const h = this.app.renderer.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const texture = Texture.from(canvas);

      if (this.bgSprite) {
        const oldTexture = this.bgSprite.texture;
        this.bgSprite.texture = texture;
        oldTexture.destroy();
      } else {
        this.bgSprite = new Sprite(texture);
        this.bgSprite.width = w;
        this.bgSprite.height = h;
        // Insert behind game layer but after background graphics
        this.app.stage.addChildAt(this.bgSprite, 1);
      }
      this.bgSprite.visible = true;

      // Hide the grid background when AI background is shown
      if (this.backgroundGraphics) {
        this.backgroundGraphics.visible = false;
      }
    };
    img.src = src;
  }

  render(engine: Engine, dt?: number): void {
    if (!this.initialized) return;

    const dtMs = dt ?? 16;
    const dtSec = dtMs / 1000;

    // Update theme if changed
    const themeId = engine.getConfig().meta.theme ?? 'fruit';
    if (themeId !== this.currentThemeId) {
      this.currentThemeId = themeId;
      this.drawBackground(getTheme(themeId));
    }

    // Render AI background image if available
    this.syncBackgroundImage(engine);

    // Screen Shake logic
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dtMs;
      this.cameraLayer.x = (Math.random() - 0.5) * 2 * this.shakeAmount;
      this.cameraLayer.y = (Math.random() - 0.5) * 2 * this.shakeAmount;
      // Sync gameLayer to cameraLayer
      this.gameLayer.x = this.cameraLayer.x;
      this.gameLayer.y = this.cameraLayer.y;
    } else {
      this.cameraLayer.x = 0;
      this.cameraLayer.y = 0;
      this.gameLayer.x = 0;
      this.gameLayer.y = 0;
    }

    // Impact Flash logic
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dtSec * 10); // Fade out quickly
      if (this.flashOverlay) {
        this.flashOverlay.alpha = this.flashAlpha;
      }
    }

    // Sync Physics2D body positions to game object renderer before sprite layout
    this.syncPhysics2DPositions(engine);

    this.gameObjectRenderer?.sync(engine);
    this.shooterRenderer?.sync(engine, dtMs);
    this.hudRenderer?.sync(engine, dtMs);
    this.rpgOverlayRenderer?.sync(engine, dtMs);

    // Physics debug overlay
    this.physicsDebugRenderer?.sync(engine);

    // Update particle and float text systems
    this.particleRenderer?.update(dtSec);
    this.floatTextRenderer?.update(dtSec);
  }

  connectToEngine(engine: Engine): void {
    if (!this.initialized) return;

    // Remove previous engine event listeners to prevent accumulation on restart
    if (this.connectedEngine) {
      for (const { event, handler } of this.engineEventHandlers) {
        this.connectedEngine.eventBus.off(event, handler);
      }
    }
    this.engineEventHandlers = [];
    this.connectedEngine = engine;

    // Reset game object renderer so player gets re-registered with collision
    this.gameObjectRenderer?.reset();
    this.shooterRenderer?.reset();
    this.rpgOverlayRenderer?.reset();
    this.physicsDebugRenderer?.reset();
    this.parallaxRenderer?.reset();

    // Create sound synth
    if (!this.soundSynth) {
      this.soundSynth = new SoundSynth();
    }

    // Helper to register and track event listeners
    const listen = (event: string, handler: (data?: any) => void) => {
      engine.eventBus.on(event, handler);
      this.engineEventHandlers.push({ event, handler });
    };

    // Wire iframes visual feedback to game object renderer (tracked for cleanup)
    this.gameObjectRenderer?.wireIFramesEvents(listen);

    // Wire physics debug renderer events
    this.physicsDebugRenderer?.wire(listen);

    // Scrolling parallax updates
    listen('scrolling:update', (data?: any) => {
      const layers = data?.layers as ReadonlyArray<{ textureId: string; ratio: number; offsetX: number; offsetY: number }> | undefined;
      if (layers && this.parallaxRenderer) {
        const assets = engine.getConfig().assets ?? {};
        this.parallaxRenderer.updateFromStates(layers, assets);
      }
    });

    listen('collision:hit', (data?: any) => {
      const x = data?.x ?? 540;
      const y = data?.y ?? 960;
      this.particleRenderer?.burst(x, y, 0xFFD700, 8);
      this.floatTextRenderer?.spawn(x, y - 30, '+10', 0xFFD700);
      this.soundSynth?.playScore();
      // Screen shake on hit
      this.shakeAmount = 5;
      this.shakeDuration = 100;
    });

    listen('collision:damage', (data?: any) => {
      const x = data?.x ?? 540;
      const y = data?.y ?? 960;
      this.particleRenderer?.burst(x, y, 0xFF4757, 10);
      this.soundSynth?.playHit();
      // Heavy screen shake and impact flash on damage
      this.shakeAmount = 15;
      this.shakeDuration = 300;
      this.flashAlpha = 0.4;
    });

    listen('scorer:update', (data?: any) => {
      const combo = data?.combo ?? 0;
      if (combo > 1) {
        this.floatTextRenderer?.spawn(540, 700, `\u{1F525} x${combo} COMBO!`, 0xff6b9d);
        this.soundSynth?.playCombo(combo);
        // Small shake on combo
        this.shakeAmount = 3;
        this.shakeDuration = 50;
      }
    });

    listen('gameflow:state', (data?: any) => {
      if (data?.state === 'finished') {
        this.soundSynth?.playGameOver();
        // Shake on game over
        this.shakeAmount = 10;
        this.shakeDuration = 500;
      }
    });

    listen('beat:hit', (data?: any) => {
      this.hudRenderer?.showRhythmFeedback(data?.accuracy ?? 0.5);
      // Small shake on rhythm hit
      this.shakeAmount = 4;
      this.shakeDuration = 80;
    });

    listen('beat:miss', () => {
      this.hudRenderer?.showRhythmFeedback(0);
      // Medium shake on miss
      this.shakeAmount = 8;
      this.shakeDuration = 150;
    });

    // Shooter events
    listen('enemy:death', (data?: any) => {
      const x = data?.x ?? 540;
      const y = data?.y ?? 960;
      this.particleRenderer?.burst(x, y, 0xFF6B6B, 12);
      this.floatTextRenderer?.spawn(x, y - 30, 'KILL!', 0xFF4500);
      this.soundSynth?.playScore();
      // Shake on enemy death
      this.shakeAmount = 10;
      this.shakeDuration = 200;
    });

    // Tween visual updates — route to sub-renderers
    listen('tween:update', (data?: any) => {
      const entityId = data?.entityId as string | undefined;
      const properties = data?.properties as Record<string, number> | undefined;
      if (!entityId || !properties) return;
      // Try game object renderer first, then shooter renderer
      const handled = this.gameObjectRenderer?.applyTweenUpdate(entityId, properties);
      if (!handled) {
        this.shooterRenderer?.applyTweenUpdate(entityId, properties);
      }
    });

    listen('tween:complete', (data?: any) => {
      const entityId = data?.entityId as string | undefined;
      if (!entityId) return;
      this.gameObjectRenderer?.clearTweenOffset(entityId);
      this.shooterRenderer?.clearTweenOffset(entityId);
    });

    listen('shield:block', () => {
      this.shooterRenderer?.flashShield();
    });

    listen('shield:break', () => {
      this.particleRenderer?.burst(540, 1600, 0x4488FF, 15);
    });

    listen('wave:start', (data?: any) => {
      const wave = data?.wave ?? 1;
      this.floatTextRenderer?.spawn(540, 400, `WAVE ${wave}`, 0xFFFFFF);
    });

    // RPG events
    listen('levelup:levelup', (data?: any) => {
      const level = data?.level ?? 1;
      this.floatTextRenderer?.spawn(540, 600, `LEVEL UP! Lv.${level}`, 0xFFD700);
      this.particleRenderer?.burst(540, 800, 0xFFD700, 20);
    });

    listen('skill:activate', (data?: any) => {
      const name = data?.name ?? 'Skill';
      this.floatTextRenderer?.spawn(540, 700, name, 0x00BFFF);
    });

    listen('drop:spawn', (data?: any) => {
      if (data) {
        const configAssets = engine.getConfig().assets ?? {};
        this.rpgOverlayRenderer?.addDrop(data, configAssets as Record<string, { src: string }>);
      }
    });

    // Canvas click handler for start/restart game flow
    const canvas = this.app.canvas;
    if (canvas) {
      // Remove previous handler if any
      if (this.canvasClickHandler) {
        canvas.removeEventListener('click', this.canvasClickHandler);
      }
      this.canvasClickHandler = () => {
        const gameFlows = engine.getModulesByType('GameFlow');
        if (gameFlows.length === 0) return;
        const gf = gameFlows[0] as GameFlow;
        const state = gf.getState();
        if (state === 'ready') {
          gf.transition('countdown');
        } else if (state === 'finished') {
          // Emit pause to set gameflowPaused=true via event (respects BaseModule encapsulation)
          engine.eventBus.emit('gameflow:pause');
          for (const mod of engine.getAllModules()) {
            const resettable = mod as { reset?: () => void };
            resettable.reset?.();
          }
          // Reset renderer so player gets re-registered with collision
          this.gameObjectRenderer?.reset();
          gf.transition('countdown');
        }
      };
      canvas.addEventListener('click', this.canvasClickHandler);
    }
  }

  getApp(): Application {
    return this.app;
  }

  getGameLayer(): Container {
    return this.gameLayer;
  }

  getCameraLayer(): Container {
    return this.cameraLayer;
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return;
    this.app.renderer.resize(width, height);
    // Redraw background at new size
    if (this.currentThemeId) {
      this.drawBackground(getTheme(this.currentThemeId));
    }
    this.parallaxRenderer?.resize(width, height);
  }

  /** Sync Physics2D body positions into GameObjectRenderer before sprite layout */
  private syncPhysics2DPositions(engine: Engine): void {
    const physics2d = engine.getModulesByType('Physics2D')[0] as any;
    if (!physics2d || !this.gameObjectRenderer) return;
    const spawners = engine.getModulesByType('Spawner');
    for (const spawner of spawners) {
      const objects = (spawner as any).getObjects?.() ?? [];
      for (const obj of objects) {
        const pos = physics2d.getBodyPosition(obj.id);
        if (pos) {
          this.gameObjectRenderer.applyPhysicsPosition(obj.id, pos.x, pos.y);
        }
      }
    }
  }

  destroy(): void {
    if (!this.initialized) return;
    this.initialized = false;

    // Clean up engine event listeners to prevent leaks
    if (this.connectedEngine) {
      for (const { event, handler } of this.engineEventHandlers) {
        this.connectedEngine.eventBus.off(event, handler);
      }
    }
    this.engineEventHandlers = [];

    if (this.canvasClickHandler) {
      this.app.canvas?.removeEventListener('click', this.canvasClickHandler);
      this.canvasClickHandler = null;
    }
    this.gameObjectRenderer?.destroy();
    this.gameObjectRenderer = null;
    this.hudRenderer = null;
    this.shooterRenderer?.destroy();
    this.shooterRenderer = null;
    this.rpgOverlayRenderer?.destroy();
    this.rpgOverlayRenderer = null;
    this.physicsDebugRenderer?.destroy();
    this.physicsDebugRenderer = null;
    this.parallaxRenderer?.destroy();
    this.parallaxRenderer = null;
    this.particleRenderer?.destroy();
    this.particleRenderer = null;
    this.floatTextRenderer?.destroy();
    this.floatTextRenderer = null;
    this.soundSynth?.destroy();
    this.soundSynth = null;
    this.connectedEngine = null;
    this.backgroundGraphics = null;
    this.currentThemeId = null;
    try {
      this.app.destroy(true);
    } catch {
      // App may have been partially torn down already
    }
  }
}

/**
 * Parse an rgba() CSS color string to a numeric color and alpha.
 * Example: 'rgba(0,212,255,0.05)' → { color: 0x00d4ff, alpha: 0.05 }
 */
function parseRgba(rgba: string): { color: number; alpha: number } {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return { color: 0x333333, alpha: 0.05 };
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  const a = match[4] != null ? parseFloat(match[4]) : 1;
  return { color: (r << 16) | (g << 8) | b, alpha: a };
}
