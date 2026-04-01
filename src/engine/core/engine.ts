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
  private disabledModules = new Set<string>();
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private running = false;
  private rafId: number | null = null;
  private lastTime = 0;

  // --- Module management ---

  addModule(module: GameModule): void {
    try {
      module.init(this);
      module.onAttach(this);
      this.modules.set(module.id, module);
    } catch (err) {
      try { module.destroy(); } catch { /* best-effort cleanup */ }
      throw err;
    }
  }

  removeModule(id: string): void {
    const module = this.modules.get(id);
    if (!module) return;
    this.modules.delete(id);
    try {
      module.onDetach(this);
    } catch (err) {
      this.eventBus.emit('engine:module-error', {
        moduleId: module.id, moduleType: module.type, error: err,
      });
    }
    try {
      module.destroy();
    } catch (err) {
      this.eventBus.emit('engine:module-error', {
        moduleId: module.id, moduleType: module.type, error: err,
      });
    }
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
      try {
        const dt = now - this.lastTime;
        this.lastTime = now;
        this.tick(dt);
      } finally {
        if (this.running) {
          this.rafId = requestAnimationFrame(loop);
        }
      }
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
      if (this.disabledModules.has(mod.id)) continue;
      try {
        mod.update(dt);
      } catch (err) {
        this.disabledModules.add(mod.id);
        this.eventBus.emit('engine:module-error', {
          moduleId: mod.id,
          moduleType: mod.type,
          error: err,
        });
      }
    }
  }

  restart(): void {
    this.stop();
    for (const mod of this.modules.values()) {
      mod.onDetach(this);
      mod.destroy();
    }
    this.modules.clear();
    this.disabledModules.clear();
    this.eventBus.clearAll();
  }
}
