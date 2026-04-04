// tools/m0/calibration/extract-params.ts
// Extracts canonical parameters from normalized expert docs.

import type { NormalizedExpert, SceneNode } from '../schema/expert-types';

/** Canonical parameter definitions: key → description */
export const CANONICAL_PARAMS: Record<string, string> = {
  object_count: 'Total interactive scene objects',
  max_width: 'Largest object width (scaled to AIGE)',
  max_height: 'Largest object height (scaled to AIGE)',
  canvas_coverage: 'Max object area / canvas area ratio (0-1)',
  has_physics: 'Uses RigidBody2D (boolean as 0/1)',
  has_box_collider: 'Uses BoxCollider2D',
  has_circle_collider: 'Uses CircleCollider2D',
  has_edge_collider: 'Uses EdgeCollider2D',
  has_tween: 'Uses TweenComponent',
  has_face_tracking: 'Uses face capture/binding',
  has_audio: 'Uses AudioComponent',
  has_text: 'Uses TextJS for UI',
  collider_count: 'Total collider components',
  complexity_score: 'Derived: object_count * (1 + physics + tween)',
  step_count: 'Command sequence length (commands only)',
  input_count: 'Decompose input param count (commands only)',
  has_gravity: 'Decompose inputs include gravity',
  has_mass: 'Decompose inputs include mass',
  has_velocity: 'Decompose inputs include velocity',
};

export type CanonicalParams = Partial<Record<keyof typeof CANONICAL_PARAMS, number | boolean>>;

const AIGE_CANVAS_AREA = 1080 * 1920;

// --- Scene Tree Walkers ---

interface SceneStats {
  objectCount: number;
  maxWidth: number;
  maxHeight: number;
  maxArea: number;
  colliderCount: number;
  hasPhysics: boolean;
  hasBoxCollider: boolean;
  hasCircleCollider: boolean;
  hasEdgeCollider: boolean;
  hasTween: boolean;
  hasFaceTracking: boolean;
  hasAudio: boolean;
  hasText: boolean;
}

function walkSceneTree(node: SceneNode, stats: SceneStats): void {
  stats.objectCount++;

  const w = node.size[0] ?? 0;
  const h = node.size[1] ?? 0;
  if (w > stats.maxWidth) stats.maxWidth = w;
  if (h > stats.maxHeight) stats.maxHeight = h;
  const area = w * h;
  if (area > stats.maxArea) stats.maxArea = area;

  const comps = node.components ?? [];
  for (const c of comps) {
    if (c.includes('RigidBody2D')) stats.hasPhysics = true;
    if (c.includes('BoxCollider2D')) {
      stats.hasBoxCollider = true;
      stats.colliderCount++;
    }
    if (c.includes('CircleCollider2D')) {
      stats.hasCircleCollider = true;
      stats.colliderCount++;
    }
    if (c.includes('EdgeCollider2D')) {
      stats.hasEdgeCollider = true;
      stats.colliderCount++;
    }
    if (c.includes('Tween')) stats.hasTween = true;
    if (c.includes('FaceCapture') || c.includes('FaceBinding') || c.includes('FaceInset'))
      stats.hasFaceTracking = true;
    if (c.includes('Audio')) stats.hasAudio = true;
    if (c.includes('TextJS')) stats.hasText = true;
  }

  if (node.children) {
    for (const child of node.children) {
      walkSceneTree(child, stats);
    }
  }
}

function initStats(): SceneStats {
  return {
    objectCount: 0,
    maxWidth: 0,
    maxHeight: 0,
    maxArea: 0,
    colliderCount: 0,
    hasPhysics: false,
    hasBoxCollider: false,
    hasCircleCollider: false,
    hasEdgeCollider: false,
    hasTween: false,
    hasFaceTracking: false,
    hasAudio: false,
    hasText: false,
  };
}

// --- Extractors ---

function extractFromKnowledge(doc: Extract<NormalizedExpert, { kind: 'knowledge' }>): CanonicalParams {
  if (!doc.sceneTree) return {};

  const stats = initStats();
  walkSceneTree(doc.sceneTree, stats);

  const coverage = stats.maxArea / AIGE_CANVAS_AREA;
  const complexityBonus = (stats.hasPhysics ? 1 : 0) + (stats.hasTween ? 1 : 0);

  return {
    object_count: stats.objectCount,
    max_width: stats.maxWidth,
    max_height: stats.maxHeight,
    canvas_coverage: Math.round(coverage * 1000) / 1000,
    has_physics: stats.hasPhysics,
    has_box_collider: stats.hasBoxCollider,
    has_circle_collider: stats.hasCircleCollider,
    has_edge_collider: stats.hasEdgeCollider,
    has_tween: stats.hasTween,
    has_face_tracking: stats.hasFaceTracking,
    has_audio: stats.hasAudio,
    has_text: stats.hasText,
    collider_count: stats.colliderCount,
    complexity_score: stats.objectCount * (1 + complexityBonus),
  };
}

function extractFromCommand(doc: Extract<NormalizedExpert, { kind: 'command' }>): CanonicalParams {
  const inputs = new Set(doc.decomposeInputs.map((s) => s.toLowerCase()));
  return {
    step_count: doc.steps.length,
    input_count: doc.decomposeInputs.length,
    has_gravity: inputs.has('gravity'),
    has_mass: inputs.has('mass'),
    has_velocity: inputs.has('velocity'),
  };
}

function extractFromTemplate(_doc: Extract<NormalizedExpert, { kind: 'template' }>): CanonicalParams {
  return {};
}

function extractFromSnapshot(_doc: Extract<NormalizedExpert, { kind: 'snapshot' }>): CanonicalParams {
  return {};
}

export function extractParams(doc: NormalizedExpert): CanonicalParams {
  switch (doc.kind) {
    case 'knowledge':
      return extractFromKnowledge(doc);
    case 'command':
      return extractFromCommand(doc);
    case 'template':
      return extractFromTemplate(doc);
    case 'snapshot':
      return extractFromSnapshot(doc);
  }
}
