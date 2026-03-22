import type {
  GameModule,
  GameEngine,
  ModuleSchema,
  EventHandler,
} from '@/engine/core';

export abstract class BaseModule implements GameModule {
  readonly id: string;
  abstract readonly type: string;

  protected engine: GameEngine | null = null;
  protected params: Record<string, any>;

  constructor(id: string, params: Record<string, any> = {}) {
    this.id = id;
    // Merge defaults from schema with provided params
    const schema = this.getSchema();
    const defaults: Record<string, any> = {};
    for (const [key, field] of Object.entries(schema)) {
      if (field.default !== undefined) {
        defaults[key] = field.type === 'object' && typeof field.default === 'object'
          ? { ...field.default }
          : field.default;
      }
    }
    this.params = { ...defaults, ...params };
  }

  init(engine: GameEngine): void {
    this.engine = engine;
  }

  onAttach(engine: GameEngine): void {
    this.engine = engine;
  }

  onDetach(_engine: GameEngine): void {
    this.engine = null;
  }

  destroy(): void {
    this.engine = null;
  }

  configure(params: Record<string, any>): void {
    this.params = { ...this.params, ...params };
  }

  getParams(): Record<string, any> {
    return { ...this.params };
  }

  abstract update(dt: number): void;
  abstract getSchema(): ModuleSchema;

  // --- Helpers ---

  protected emit(event: string, data?: unknown): void {
    this.engine?.eventBus.emit(event, data);
  }

  protected on(event: string, handler: EventHandler): void {
    this.engine?.eventBus.on(event, handler);
  }
}
