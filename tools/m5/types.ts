// tools/m5/types.ts
// M5 Expert Data Ingest — Intermediate Representation types.

export type ExpertFormat = 'knowledge' | 'sequence' | 'utility';

export type AssetType = 'image' | 'audio' | 'video' | 'unknown';

export interface IRParamSpec {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
}

export interface IRAsset {
  readonly id: string;
  readonly type: AssetType;
  readonly src: string;
}

export interface ModuleHint {
  readonly type: string;
  readonly params: Record<string, unknown>;
}

export interface ExpertIR {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly gameTypeHint: string | null;
  readonly aigeGameType: string;
  readonly tags: readonly string[];
  readonly params: readonly IRParamSpec[];
  readonly assets: readonly IRAsset[];
  readonly moduleHints: readonly ModuleHint[];
  readonly unmappedComponents: readonly string[];
  readonly sourcePath: string;
  readonly confidence: number;
}
