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

  /**
   * Whether this module is paused by GameFlow.
   * Starts as true — modules only run after gameflow:resume (entering 'playing').
   * Modules whose update() should respect this must check: if (this.gameflowPaused) return;
   */
  protected gameflowPaused = true;

  private readonly _onResume = () => { this.gameflowPaused = false; };
  private readonly _onPause = () => { this.gameflowPaused = true; };

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
    this.engine.eventBus.on('gameflow:resume', this._onResume);
    this.engine.eventBus.on('gameflow:pause', this._onPause);
  }

  onAttach(engine: GameEngine): void {
    this.engine = engine;
  }

  onDetach(_engine: GameEngine): void {
    this.engine = null;
  }

  destroy(): void {
    this.engine?.eventBus.off('gameflow:resume', this._onResume);
    this.engine?.eventBus.off('gameflow:pause', this._onPause);
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
