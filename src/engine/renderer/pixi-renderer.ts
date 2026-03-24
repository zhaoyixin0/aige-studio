import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import { GameObjectRenderer } from './game-object-renderer';
import { HudRenderer } from './hud-renderer';
import { ParticleRenderer } from './particle-renderer';
import { FloatTextRenderer } from './float-text-renderer';
import { SoundSynth } from './sound-synth';
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
  private initialized = false;
  private currentThemeId: string | null = null;
  private connectedEngine: Engine | null = null;
  private canvasClickHandler: (() => void) | null = null;
  private bgSprite: Sprite | null = null;
  private bgSrc: string | null = null;
  private engineEventHandlers: Array<{ event: string; handler: (data?: any) => void }> = [];

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
    });
    this.initialized = true;

    // Background goes behind everything
    this.backgroundGraphics = new Graphics();
    this.app.stage.addChild(this.backgroundGraphics);

    this.app.stage.addChild(this.cameraLayer, this.gameLayer, this.hudLayer);

    this.gameObjectRenderer = new GameObjectRenderer(this.gameLayer);
    this.hudRenderer = new HudRenderer(this.hudLayer, width, height);
    this.particleRenderer = new ParticleRenderer(this.gameLayer);
    this.floatTextRenderer = new FloatTextRenderer(this.gameLayer);

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
    const bgAsset = engine.getConfig().assets?.background;
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

    // Update theme if changed
    const themeId = engine.getConfig().meta.theme ?? 'fruit';
    if (themeId !== this.currentThemeId) {
      this.currentThemeId = themeId;
      this.drawBackground(getTheme(themeId));
    }

    // Render AI background image if available
    this.syncBackgroundImage(engine);

    this.gameObjectRenderer?.sync(engine);
    this.hudRenderer?.sync(engine, dt ?? 16);

    // Update particle and float text systems
    if (dt != null) {
      const dtSec = dt / 1000; // convert ms to seconds
      this.particleRenderer?.update(dtSec);
      this.floatTextRenderer?.update(dtSec);
    }
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

    // Create sound synth
    if (!this.soundSynth) {
      this.soundSynth = new SoundSynth();
    }

    // Helper to register and track event listeners
    const listen = (event: string, handler: (data?: any) => void) => {
      engine.eventBus.on(event, handler);
      this.engineEventHandlers.push({ event, handler });
    };

    listen('collision:hit', (data?: any) => {
      const x = data?.x ?? 540;
      const y = data?.y ?? 960;
      this.particleRenderer?.burst(x, y, 0xFFD700, 8);
      this.floatTextRenderer?.spawn(x, y - 30, '+10', 0xFFD700);
      this.soundSynth?.playScore();
    });

    listen('collision:damage', (data?: any) => {
      const x = data?.x ?? 540;
      const y = data?.y ?? 960;
      this.particleRenderer?.burst(x, y, 0xFF4757, 10);
      this.soundSynth?.playHit();
    });

    listen('scorer:update', (data?: any) => {
      const combo = data?.combo ?? 0;
      if (combo > 1) {
        this.floatTextRenderer?.spawn(540, 700, `\u{1F525} x${combo} COMBO!`, 0xff6b9d);
        this.soundSynth?.playCombo(combo);
      }
    });

    listen('gameflow:state', (data?: any) => {
      if (data?.state === 'finished') {
        this.soundSynth?.playGameOver();
      }
    });

    listen('beat:hit', (data?: any) => {
      this.hudRenderer?.showRhythmFeedback(data?.accuracy ?? 0.5);
    });

    listen('beat:miss', () => {
      this.hudRenderer?.showRhythmFeedback(0);
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
        const gf = gameFlows[0] as any;
        const state = gf.getState();
        if (state === 'ready') {
          gf.transition('countdown');
        } else if (state === 'finished') {
          for (const mod of engine.getAllModules()) {
            // Reset gameflowPaused to true before module-specific reset
            (mod as any).gameflowPaused = true;
            (mod as any).reset?.();
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
    this.gameObjectRenderer = null;
    this.hudRenderer = null;
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
