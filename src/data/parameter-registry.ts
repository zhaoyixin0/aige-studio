// Parameter Registry — types and query APIs
// Data is in parameter-data.ts (auto-generated from Excel)

export type ParamLayer = 'L1' | 'L2' | 'L3';
export type ParamCategory =
  | 'abstract'
  | 'game_mechanics'
  | 'game_objects'
  | 'visual_audio'
  | 'input'
  | 'online';
export type ParamMvp = 'P0' | 'P1' | 'P2' | 'P3';
export type ParamExposure = 'direct' | 'composite' | 'hidden';
export type ParamControlType =
  | 'toggle'
  | 'slider'
  | 'segmented'
  | 'stepper'
  | 'asset_picker'
  | 'input_field';

export interface ParameterMeta {
  readonly id: string;
  readonly name: string;
  readonly layer: ParamLayer;
  readonly category: ParamCategory;
  readonly mvp: ParamMvp;
  readonly exposure: ParamExposure;
  readonly controlType: ParamControlType;
  readonly gameTypes: readonly string[];
  readonly defaultValue: string | number | boolean;
  readonly options?: readonly string[];
  readonly dependsOn?: {
    readonly paramId: string;
    readonly condition: string;
  };
  readonly associatedL1?: string;
  readonly description: string;
}

import { PARAMETER_DATA } from './parameter-data';

export const PARAMETER_REGISTRY: readonly ParameterMeta[] = PARAMETER_DATA;

// --- Query APIs (cached) ---

const _byId = new Map<string, ParameterMeta>(
  PARAMETER_REGISTRY.map((p) => [p.id, p])
);

export function getParamById(id: string): ParameterMeta | undefined {
  return _byId.get(id);
}

export function getParamsForGameType(gameType: string): readonly ParameterMeta[] {
  return PARAMETER_REGISTRY.filter(
    (p) => p.gameTypes.includes('ALL') || p.gameTypes.includes(gameType)
  );
}

export function getParamsByLayer(layer: ParamLayer): readonly ParameterMeta[] {
  return PARAMETER_REGISTRY.filter((p) => p.layer === layer);
}

export function getParamsByCategory(
  category: ParamCategory
): readonly ParameterMeta[] {
  return PARAMETER_REGISTRY.filter((p) => p.category === category);
}
