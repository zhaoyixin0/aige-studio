// tools/m0/benchmark/feel-score.ts
// 8-dimension Game Feel Score engine.
// Scores 0-100, weighted sigmoid-based per dimension.

import type { CanonicalParams } from '../calibration/extract-params';

export interface Dimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

export const DIMENSIONS: readonly Dimension[] = [
  { name: 'Responsiveness', weight: 0.15, description: 'Input-to-action latency and feedback' },
  { name: 'MotionFidelity', weight: 0.15, description: 'Smoothness of movement and animations' },
  { name: 'CollisionFairness', weight: 0.12, description: 'Collider accuracy and hit registration' },
  { name: 'Timing', weight: 0.12, description: 'Game pacing and spawn timing' },
  { name: 'FeedbackRichness', weight: 0.12, description: 'VFX, SFX, haptic responses' },
  { name: 'DifficultyRamp', weight: 0.10, description: 'Progressive challenge increase' },
  { name: 'Consistency', weight: 0.12, description: 'Predictable physics and behaviors' },
  { name: 'UIClarity', weight: 0.12, description: 'HUD, score display, flow indicators' },
];

export interface FeelScoreResult {
  readonly total: number;
  readonly dimensions: Record<string, number>;
  readonly badge: 'bronze' | 'silver' | 'gold' | 'expert';
}

// Sigmoid-like scoring: maps raw value to 0-100 with configurable midpoint
function sigmoid(value: number, midpoint: number, steepness: number): number {
  const x = (value - midpoint) * steepness;
  return 100 / (1 + Math.exp(-x));
}

// Capability sets that boost specific dimensions
const FEEDBACK_MODULES = new Set([
  'ParticleVFX', 'SoundFX', 'UIOverlay', 'ResultScreen', 'CameraFollow',
]);
const PHYSICS_MODULES = new Set([
  'Gravity', 'Jump', 'Knockback', 'Dash', 'CoyoteTime',
  'StaticPlatform', 'MovingPlatform', 'CrumblingPlatform',
]);
const TIMING_MODULES = new Set([
  'Timer', 'DifficultyRamp', 'BeatMap', 'GameFlow',
]);
const COLLISION_MODULES = new Set([
  'Collision', 'Health', 'Shield', 'IFrames',
]);
const UI_MODULES = new Set([
  'UIOverlay', 'ResultScreen', 'Scorer', 'Lives',
]);

function scoreResponsiveness(params: CanonicalParams, modules: readonly string[]): number {
  const moduleCount = modules.length;
  const hasInput = modules.some((m) => m.includes('Input'));
  const base = sigmoid(moduleCount, 4, 0.5);
  return Math.min(100, base + (hasInput ? 10 : 0));
}

function scoreMotionFidelity(params: CanonicalParams, modules: readonly string[]): number {
  const hasTween = params.has_tween ? 15 : 0;
  const physicsCount = modules.filter((m) => PHYSICS_MODULES.has(m)).length;
  return Math.min(100, sigmoid(physicsCount, 2, 0.8) + hasTween);
}

function scoreCollisionFairness(params: CanonicalParams, modules: readonly string[]): number {
  const colliders = typeof params.collider_count === 'number' ? params.collider_count : 0;
  const collisionModules = modules.filter((m) => COLLISION_MODULES.has(m)).length;
  return sigmoid(colliders + collisionModules * 3, 4, 0.4);
}

function scoreTiming(params: CanonicalParams, modules: readonly string[]): number {
  const timingCount = modules.filter((m) => TIMING_MODULES.has(m)).length;
  return sigmoid(timingCount, 2, 0.8);
}

function scoreFeedbackRichness(params: CanonicalParams, modules: readonly string[]): number {
  const feedbackCount = modules.filter((m) => FEEDBACK_MODULES.has(m)).length;
  return sigmoid(feedbackCount, 2, 0.7);
}

function scoreDifficultyRamp(params: CanonicalParams, modules: readonly string[]): number {
  const hasDifficulty = modules.includes('DifficultyRamp') ? 40 : 0;
  const complexity = typeof params.complexity_score === 'number' ? params.complexity_score : 0;
  return Math.min(100, hasDifficulty + sigmoid(complexity, 15, 0.15));
}

function scoreConsistency(params: CanonicalParams, modules: readonly string[]): number {
  const hasPhysics = params.has_physics ? 20 : 0;
  const objectCount = typeof params.object_count === 'number' ? params.object_count : 0;
  return Math.min(100, sigmoid(objectCount, 10, 0.2) + hasPhysics);
}

function scoreUIClarity(params: CanonicalParams, modules: readonly string[]): number {
  const uiCount = modules.filter((m) => UI_MODULES.has(m)).length;
  const hasText = params.has_text ? 10 : 0;
  return Math.min(100, sigmoid(uiCount, 2, 0.7) + hasText);
}

const SCORERS = [
  scoreResponsiveness,
  scoreMotionFidelity,
  scoreCollisionFairness,
  scoreTiming,
  scoreFeedbackRichness,
  scoreDifficultyRamp,
  scoreConsistency,
  scoreUIClarity,
];

function getBadge(score: number): FeelScoreResult['badge'] {
  if (score >= 85) return 'expert';
  if (score >= 70) return 'gold';
  if (score >= 50) return 'silver';
  return 'bronze';
}

export function computeFeelScore(
  params: CanonicalParams,
  modules: readonly string[],
): FeelScoreResult {
  const dimensions: Record<string, number> = {};
  let total = 0;

  for (let i = 0; i < DIMENSIONS.length; i++) {
    const dim = DIMENSIONS[i];
    const raw = SCORERS[i](params, modules);
    const score = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
    dimensions[dim.name] = score;
    total += score * dim.weight;
  }

  total = Math.round(Math.max(0, Math.min(100, total)) * 10) / 10;

  return { total, dimensions, badge: getBadge(total) };
}
