// tools/m0/schema/guards.ts
// Runtime type guards + normalizer for expert JSON docs.
// Applies 1.5x scale factor (Effect House 720x1280 → AIGE 1080x1920).

import type {
  NormalizedExpert,
  ExpertKnowledge,
  ExpertCommand,
  ExpertTemplate,
  ExpertSnapshot,
  SceneNode,
  CommandStep,
} from './expert-types';

export type { NormalizedExpert };

const SCALE_FACTOR = 1.5;

// --- Type Guards ---

export function isKnowledge(raw: Record<string, unknown>): boolean {
  return 'game_type' in raw && typeof raw.game_type === 'string';
}

export function isCommand(raw: Record<string, unknown>): boolean {
  return 'command_sequence' in raw && Array.isArray(raw.command_sequence);
}

export function isTemplate(raw: Record<string, unknown>): boolean {
  return ('name' in raw && 'data' in raw) || isMultiTemplate(raw);
}

export function isSnapshot(raw: Record<string, unknown>): boolean {
  return !isKnowledge(raw) && !isCommand(raw) && !isTemplate(raw);
}

function isMultiTemplate(raw: Record<string, unknown>): boolean {
  const keys = Object.keys(raw);
  return (
    keys.length >= 2 &&
    keys.every((k) => typeof raw[k] === 'object' && raw[k] !== null) &&
    !('game_type' in raw) &&
    !('command_sequence' in raw)
  );
}

// --- Scale Helpers ---

function scalePosition(pos: unknown): readonly number[] {
  if (!Array.isArray(pos)) return [0, 0];
  return pos.map((v) => (typeof v === 'number' ? Math.round(v * SCALE_FACTOR * 1000) / 1000 : 0));
}

function scaleSize(size: unknown): readonly number[] {
  if (!Array.isArray(size)) return [0, 0];
  return size.map((v) => (typeof v === 'number' ? Math.round(v * SCALE_FACTOR * 1000) / 1000 : 0));
}

function scaleSceneNode(node: Record<string, unknown>): SceneNode {
  const children = Array.isArray(node.children)
    ? node.children.map((c: unknown) => scaleSceneNode(c as Record<string, unknown>))
    : undefined;

  return {
    objectName: String(node.objectName ?? ''),
    type: node.type != null ? String(node.type) : undefined,
    position: scalePosition(node.position),
    scale: Array.isArray(node.scale) ? node.scale.map(Number) : undefined,
    rotation: Array.isArray(node.rotation) ? node.rotation.map(Number) : undefined,
    size: scaleSize(node.size),
    notes: node.notes != null ? String(node.notes) : undefined,
    components: Array.isArray(node.components) ? node.components.map(String) : undefined,
    children,
  };
}

// --- Normalizers ---

function normalizeKnowledge(raw: Record<string, unknown>, filename: string): ExpertKnowledge {
  const gameType = String(raw.game_type ?? '').trim().toLowerCase();
  const description = String(raw.description ?? '').trim();
  const examples = Array.isArray(raw.examples) ? raw.examples.map((e: unknown) => String(e)) : [];
  const sceneTree =
    raw.root && typeof raw.root === 'object'
      ? scaleSceneNode(raw.root as Record<string, unknown>)
      : null;

  return { kind: 'knowledge', filename, gameType, description, examples, sceneTree };
}

function normalizeStep(step: Record<string, unknown>): CommandStep {
  const args = step.arguments;
  const safeArgs =
    typeof args === 'object' && args !== null && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  return {
    name: String(step.name ?? ''),
    arguments: safeArgs,
    index: Number(step.index ?? 0),
    comment: step.comment != null ? String(step.comment) : undefined,
  };
}

function normalizeCommand(raw: Record<string, unknown>, filename: string): ExpertCommand {
  const description = String(raw.description ?? '').trim();
  const decomposeInputs = Array.isArray(raw.decompose_inputs)
    ? raw.decompose_inputs.map(String)
    : [];
  const steps = (raw.command_sequence as Record<string, unknown>[]).map(normalizeStep);

  return { kind: 'command', filename, description, decomposeInputs, steps };
}

function normalizeTemplate(raw: Record<string, unknown>, filename: string): ExpertTemplate {
  if ('name' in raw && 'data' in raw) {
    return {
      kind: 'template',
      filename,
      name: String(raw.name),
      data: raw.data,
    };
  }
  // Multi-template: use filename as name, entire object as data
  const baseName = filename.replace(/\.json$/, '');
  return { kind: 'template', filename, name: baseName, data: raw };
}

function normalizeSnapshot(raw: Record<string, unknown>, filename: string): ExpertSnapshot {
  return { kind: 'snapshot', filename, entries: { ...raw } };
}

// --- Main Normalizer ---

export function normalizeExpert(raw: Record<string, unknown>, filename: string): NormalizedExpert {
  if (isCommand(raw)) return normalizeCommand(raw, filename);
  if (isKnowledge(raw)) return normalizeKnowledge(raw, filename);
  if ('name' in raw && 'data' in raw) return normalizeTemplate(raw, filename);
  if (filename.includes('template')) return normalizeTemplate(raw, filename);
  return normalizeSnapshot(raw, filename);
}
