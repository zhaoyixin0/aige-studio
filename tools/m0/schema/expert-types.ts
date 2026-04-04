// tools/m0/schema/expert-types.ts
// TypeScript interfaces for the 4 expert JSON formats.

/** Scene tree node from Effect House .ehproj (knowledge docs) */
export interface SceneNode {
  readonly objectName: string;
  readonly type?: string;
  readonly position: readonly number[];
  readonly scale?: readonly number[];
  readonly rotation?: readonly number[];
  readonly size: readonly number[];
  readonly notes?: string;
  readonly components?: readonly string[];
  readonly children?: readonly SceneNode[];
}

/** Knowledge doc: game type definition with scene tree */
export interface ExpertKnowledge {
  readonly kind: 'knowledge';
  readonly filename: string;
  readonly gameType: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly sceneTree: SceneNode | null;
}

/** Command step from Effect House build instructions */
export interface CommandStep {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly index: number;
  readonly comment?: string;
}

/** Command doc: build instruction sequence */
export interface ExpertCommand {
  readonly kind: 'command';
  readonly filename: string;
  readonly description: string;
  readonly decomposeInputs: readonly string[];
  readonly steps: readonly CommandStep[];
}

/** Template doc: reusable pattern */
export interface ExpertTemplate {
  readonly kind: 'template';
  readonly filename: string;
  readonly name: string;
  readonly data: unknown;
}

/** Snapshot doc: ECS component dump */
export interface ExpertSnapshot {
  readonly kind: 'snapshot';
  readonly filename: string;
  readonly entries: Record<string, unknown>;
}

export type NormalizedExpert = ExpertKnowledge | ExpertCommand | ExpertTemplate | ExpertSnapshot;
