export type EventHandler = (data?: any) => void;

export interface SchemaField {
  type:
    | 'range'
    | 'number'
    | 'boolean'
    | 'select'
    | 'asset'
    | 'color'
    | 'rect'
    | 'enum[]'
    | 'asset[]'
    | 'collision-layers'
    | 'collision-rules'
    | 'object'
    | 'string';
  label: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  assetType?: string;
  fields?: Record<string, SchemaField>;
}

export type ModuleSchema = Record<string, SchemaField>;

export interface ModuleConfig {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface AssetEntry {
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background?: string;
}

export interface GameMeta {
  name: string;
  description: string;
  thumbnail: string | null;
  createdAt: string;
  theme?: string;
}

export interface GameConfig {
  version: string;
  meta: GameMeta;
  canvas: CanvasConfig;
  modules: ModuleConfig[];
  assets: Record<string, AssetEntry>;
}

export interface GameModule {
  id: string;
  type: string;
  init(engine: GameEngine): void;
  update(dt: number): void;
  destroy(): void;
  getSchema(): ModuleSchema;
  configure(params: Record<string, any>): void;
  getParams(): Record<string, any>;
  onAttach(engine: GameEngine): void;
  onDetach(engine: GameEngine): void;
}

export interface GameEngine {
  eventBus: import('./event-bus').EventBus;
  getModule(id: string): GameModule | undefined;
  getModulesByType(type: string): GameModule[];
  getAllModules(): GameModule[];
  getConfig(): GameConfig;
  getCanvas(): CanvasConfig;
}
