import { Container, Texture, TilingSprite } from 'pixi.js';
import type { LayerState } from '@/engine/systems/scrolling-layers/types';

const TILE_SIZE = 256;

export class ParallaxRenderer {
  private container: Container;
  private layerSprites = new Map<string, TilingSprite>();
  private textureCache = new Map<string, Texture>();
  private viewW: number;
  private viewH: number;

  constructor(parent: Container, viewW: number, viewH: number) {
    this.container = new Container();
    parent.addChild(this.container);
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** Update parallax layer visuals from ScrollingLayers state */
  updateFromStates(
    states: ReadonlyArray<LayerState>,
    assets: Record<string, any>,
  ): void {
    const seen = new Set<string>();

    for (const { textureId, offsetX, offsetY } of states) {
      let sprite = this.layerSprites.get(textureId);
      if (!sprite) {
        const tex = this.resolveTexture(textureId, assets);
        sprite = new TilingSprite({ texture: tex, width: this.viewW, height: this.viewH });
        this.container.addChild(sprite);
        this.layerSprites.set(textureId, sprite);
      }
      sprite.tilePosition.set(offsetX, offsetY);
      sprite.visible = true;
      seen.add(textureId);
    }

    // Hide layers no longer in states
    for (const [id, s] of this.layerSprites) {
      if (!seen.has(id)) s.visible = false;
    }
  }

  /** Wire events using pixi-renderer's tracked listener helper */
  wire(_listen: (event: string, handler: (data?: any) => void) => void): void {
    // scrolling:update handled in PixiRenderer.connectToEngine() via listen()
  }

  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    for (const s of this.layerSprites.values()) {
      s.width = w;
      s.height = h;
    }
  }

  reset(): void {
    for (const s of this.layerSprites.values()) {
      this.container.removeChild(s);
      s.destroy();
    }
    this.layerSprites.clear();
  }

  destroy(): void {
    this.reset();
    for (const tex of this.textureCache.values()) {
      tex.destroy();
    }
    this.textureCache.clear();
    this.container.destroy();
  }

  private resolveTexture(textureId: string, assets: Record<string, any>): Texture {
    const src = assets[textureId]?.src;

    if (src?.startsWith('data:')) {
      const cached = this.textureCache.get(src);
      if (cached) return cached;

      // Return procedural placeholder immediately; async-load real texture
      const placeholder = this.buildProceduralTile(textureId);
      const capturedSrc = src;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
        const tex = Texture.from(canvas);
        this.textureCache.set(capturedSrc, tex);
        // Update existing sprite if it was created with the placeholder
        const sprite = this.layerSprites.get(textureId);
        if (sprite) sprite.texture = tex;
      };
      img.src = src;
      return placeholder;
    }

    // Procedural fallback: semi-transparent diagonal stripes
    return this.buildProceduralTile(textureId);
  }

  private buildProceduralTile(seed: string): Texture {
    const cacheKey = `proc:${seed}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    // Draw directly to Canvas 2D API (not PixiJS Graphics)
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Hash seed for subtle color variation
      const hash = seed.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const hue = Math.abs(hash) % 360;
      const r = Math.round(128 + 40 * Math.cos(hue * Math.PI / 180));
      const gv = Math.round(128 + 40 * Math.cos((hue + 120) * Math.PI / 180));
      const b = Math.round(128 + 40 * Math.cos((hue + 240) * Math.PI / 180));
      ctx.strokeStyle = `rgba(${r},${gv},${b},0.15)`;
      ctx.lineWidth = 2;
      for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + TILE_SIZE, TILE_SIZE);
        ctx.stroke();
      }
    }

    const tex = Texture.from(canvas);
    this.textureCache.set(cacheKey, tex);
    return tex;
  }
}
