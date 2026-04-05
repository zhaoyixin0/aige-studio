// Runtime Game Feel Scorer — derives a 0-100 score from live GameConfig.
// 8 weighted dimensions, sigmoid-based scoring, actionable suggestions.

import type { GameConfig } from '@/engine/core';

export interface FeelSuggestion {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly delta: number;
  readonly payload?: ReadonlyArray<{
    moduleType: string;
    params: Record<string, unknown>;
  }>;
}

export interface FeelScoreResult {
  readonly total: number;
  readonly dimensions: Readonly<Record<string, number>>;
  readonly badge: 'bronze' | 'silver' | 'gold' | 'expert' | null;
  readonly suggestions: readonly FeelSuggestion[];
}

const WEIGHTS: Readonly<Record<string, number>> = {
  Responsiveness: 0.15,
  MotionFidelity: 0.15,
  CollisionFairness: 0.12,
  Timing: 0.12,
  FeedbackRichness: 0.12,
  DifficultyRamp: 0.10,
  Consistency: 0.12,
  UIClarity: 0.12,
};

const PHYSICS_SET = new Set([
  'Gravity', 'Jump', 'Dash', 'CoyoteTime', 'Knockback',
  'StaticPlatform', 'MovingPlatform', 'CrumblingPlatform', 'WallDetect',
]);
const TIMING_SET = new Set(['Timer', 'DifficultyRamp', 'BeatMap', 'GameFlow']);
const FEEDBACK_SET = new Set([
  'ParticleVFX', 'SoundFX', 'UIOverlay', 'ResultScreen', 'CameraFollow',
]);
const COLLISION_SET = new Set(['Collision', 'Health', 'Shield', 'IFrames']);
const UI_SET = new Set(['UIOverlay', 'ResultScreen', 'Scorer', 'Lives']);

function sigmoid(value: number, midpoint: number, steepness: number): number {
  return 100 / (1 + Math.exp(-(value - midpoint) * steepness));
}

function round1(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
}

function badgeFor(total: number): FeelScoreResult['badge'] {
  if (total >= 90) return 'expert';
  if (total >= 80) return 'gold';
  if (total >= 60) return 'silver';
  if (total >= 40) return 'bronze';
  return null;
}

function deriveModuleTypes(config: GameConfig): readonly string[] {
  return (config.modules ?? [])
    .filter((m) => m.enabled !== false)
    .map((m) => m.type);
}

function countIn(types: readonly string[], set: Set<string>): number {
  return types.filter((t) => set.has(t)).length;
}

export function computeFeelScore(config: GameConfig): FeelScoreResult {
  const types = deriveModuleTypes(config);
  const has = (t: string) => types.includes(t);
  const moduleCount = types.length;

  const physicsCount = countIn(types, PHYSICS_SET);
  const timingCount = countIn(types, TIMING_SET);
  const feedbackCount = countIn(types, FEEDBACK_SET);
  const collisionCount = countIn(types, COLLISION_SET);
  const uiCount = countIn(types, UI_SET);

  const dim: Record<string, number> = {};

  dim.Responsiveness = round1(
    sigmoid(moduleCount, 4, 0.5) + (types.some((t) => t.includes('Input')) ? 10 : 0),
  );
  dim.MotionFidelity = round1(
    sigmoid(physicsCount, 2, 0.8) + (has('Tween') ? 15 : 0),
  );
  dim.CollisionFairness = round1(sigmoid(collisionCount * 3, 4, 0.4));
  dim.Timing = round1(sigmoid(timingCount, 2, 0.8));
  dim.FeedbackRichness = round1(sigmoid(feedbackCount, 2, 0.7));
  dim.DifficultyRamp = round1(
    (timingCount > 0 ? 40 : 0) + sigmoid(moduleCount, 15, 0.15),
  );
  dim.Consistency = round1(
    sigmoid(moduleCount, 10, 0.2) + (physicsCount > 0 ? 20 : 0),
  );
  dim.UIClarity = round1(
    sigmoid(uiCount, 2, 0.7) + (has('Scorer') ? 10 : 0),
  );

  let total = 0;
  for (const [k, v] of Object.entries(dim)) {
    total += v * (WEIGHTS[k] ?? 0);
  }
  total = round1(total);

  const suggestions: FeelSuggestion[] = [];
  if (!has('ParticleVFX')) {
    suggestions.push({
      id: 'add-vfx',
      title: '添加粒子特效',
      description: '为命中/得分等关键事件添加粒子反馈',
      delta: 8,
      payload: [{ moduleType: 'ParticleVFX', params: {} }],
    });
  }
  if (!has('SoundFX')) {
    suggestions.push({
      id: 'add-sfx',
      title: '添加音效',
      description: '为命中/连击/结算添加短促音效',
      delta: 7,
      payload: [{ moduleType: 'SoundFX', params: {} }],
    });
  }
  if (!has('DifficultyRamp')) {
    suggestions.push({
      id: 'add-ramp',
      title: '增加难度递增',
      description: '按时间/分数逐步提升生成频率',
      delta: 10,
      payload: [{ moduleType: 'DifficultyRamp', params: { mode: 'time' } }],
    });
  }
  if (!has('UIOverlay')) {
    suggestions.push({
      id: 'add-ui',
      title: '增加 HUD 界面',
      description: '显示分数/生命/时间等信息',
      delta: 6,
      payload: [{ moduleType: 'UIOverlay', params: {} }],
    });
  }

  return { total, dimensions: dim, badge: badgeFor(total), suggestions };
}
