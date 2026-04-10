export type EventHandler = (data?: unknown) => void;

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
    | 'string'
    | 'segmented'
    | 'stepper'
    | 'asset_picker';
  label: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  assetType?: string;
  fields?: Record<string, SchemaField>;
  assets?: ReadonlyArray<{ id: string; thumbnail: string; label?: string }>;
}

export type ModuleSchema = Record<string, SchemaField>;

export interface ModuleConfig {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
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
  artStyle?: string;
  assetDescriptions?: Record<string, string>;
  playerEmoji?: string;
  spriteSize?: number;
  /**
   * Optional hint written by preset loaders (hero-skeleton, expert facade).
   * When present, ConversationAgent.inferGameType returns this value directly
   * instead of guessing from module composition. Enables recognition of niche
   * expert gameTypes (slingshot, avatar-frame, bouncing, ...) that do not map
   * 1-to-1 onto native engine modules.
   */
  gameType?: string;
  /** Hero preset id written by hero-skeleton-builder when a preset is loaded. */
  heroPresetId?: string;
  /** Conceptual intent text carried over from a hero-skeleton. */
  concept?: string;
  /** Signature good item labels (for preset-enricher context). */
  signatureGoods?: readonly string[];
  /** Signature bad item labels (for preset-enricher context). */
  signatureBads?: readonly string[];
  /**
   * Preset enrichment lifecycle:
   *   undefined   — not a hero preset load, or not checked yet
   *   'pending'   — enrichment in flight
   *   true        — enrichment complete (diff merged)
   *   'failed'    — enrichment rejected / errored (no diff applied)
   *   'cancelled' — user cancelled mid-flight
   */
  presetEnriched?: true | 'pending' | 'failed' | 'cancelled';
}

export interface GameConfig {
  version: string;
  meta: GameMeta;
  canvas: CanvasConfig;
  modules: ModuleConfig[];
  assets: Record<string, AssetEntry>;
}

export interface ModuleDependencies {
  requires: string[];
  optional: string[];
}

export interface GameModule {
  id: string;
  type: string;
  init(engine: GameEngine): void;
  update(dt: number): void;
  destroy(): void;
  getSchema(): ModuleSchema;
  getDependencies(): ModuleDependencies;
  getContracts(): import('./contracts').ModuleContracts;
  configure(params: Record<string, unknown>): void;
  getParams(): Record<string, unknown>;
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
