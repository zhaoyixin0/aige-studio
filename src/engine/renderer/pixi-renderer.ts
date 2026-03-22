import { Application, Container } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import { GameObjectRenderer } from './game-object-renderer';
import { HudRenderer } from './hud-renderer';

export class PixiRenderer {
  private app: Application;
  private cameraLayer = new Container();
  private gameLayer = new Container();
  private hudLayer = new Container();
  private gameObjectRenderer: GameObjectRenderer | null = null;
  private hudRenderer: HudRenderer | null = null;

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
    this.app.stage.addChild(this.cameraLayer, this.gameLayer, this.hudLayer);
    this.gameObjectRenderer = new GameObjectRenderer(this.gameLayer);
    this.hudRenderer = new HudRenderer(this.hudLayer, width, height);
  }

  render(engine: Engine): void {
    this.gameObjectRenderer?.sync(engine);
    this.hudRenderer?.sync(engine);
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
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
