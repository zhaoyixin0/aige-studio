import { EventBus } from './event-bus';
import type { GameModule, GameEngine, GameConfig, CanvasConfig } from './types';

const DEFAULT_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: {
    name: 'Untitled',
    description: '',
    thumbnail: null,
    createdAt: new Date().toISOString(),
  },
  canvas: { width: 800, height: 600 },
  modules: [],
  assets: {},
};

export class Engine implements GameEngine {
  readonly eventBus = new EventBus();

  private modules = new Map<string, GameModule>();
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private running = false;
  private rafId: number | null = null;
  private lastTime = 0;

  // --- Module management ---

  addModule(module: GameModule): void {
    this.modules.set(module.id, module);
    module.init(this);
    module.onAttach(this);
  }

  removeModule(id: string): void {
    const module = this.modules.get(id);
    if (!module) return;
    module.onDetach(this);
    module.destroy();
    this.modules.delete(id);
  }

  getModule(id: string): GameModule | undefined {
    return this.modules.get(id);
  }

  getModulesByType(type: string): GameModule[] {
    const result: GameModule[] = [];
    for (const mod of this.modules.values()) {
      if (mod.type === type) {
        result.push(mod);
      }
    }
    return result;
  }

  getAllModules(): GameModule[] {
    return Array.from(this.modules.values());
  }

  // --- Config ---

  loadConfig(config: GameConfig): void {
    this.config = config;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getCanvas(): CanvasConfig {
    return this.config.canvas;
  }

  // --- Game loop ---

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.tick(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  tick(dt: number): void {
    for (const mod of this.modules.values()) {
      mod.update(dt);
    }
  }

  restart(): void {
    this.stop();
    for (const mod of this.modules.values()) {
      mod.onDetach(this);
      mod.destroy();
    }
    this.modules.clear();
    this.eventBus.clearAll();
  }
}
