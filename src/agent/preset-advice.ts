// src/agent/preset-advice.ts
//
// Pure drift detector that compares the current GameConfig to an expert card's
// `signatureParams`. Returns human-readable advice entries ready for display
// in the chat UI (see validation-summary-block "advice" mode).
//
// Design notes:
//   - Only numeric params are considered — string/boolean params are skipped.
//   - Low-confidence (< 0.3) signature params are ignored.
//   - Deviation threshold is ±50% relative to the suggested value.
//   - Scene-level metrics (object_count, collider_count) are derived from the
//     config because they do not live as named module params.

import type { GameConfig, ModuleConfig } from '@/engine/core/types';
import { SkillLoader, type ExpertCardRaw } from './skill-loader';

export interface PresetAdvice {
  readonly level: 'info' | 'warning';
  readonly moduleType: string;
  readonly paramKey: string;
  readonly actualValue: number;
  readonly suggestedValue: number;
  readonly confidence: number;
  readonly message: string;
}

const MIN_CONFIDENCE = 0.3;
const DRIFT_THRESHOLD = 0.5;
const MAX_ADVICE = 5;
const WARNING_CONFIDENCE = 0.7;

const COLLIDER_MODULE_TYPES: ReadonlySet<string> = new Set([
  'Spawner',
  'Collision',
  'Collectible',
  'Hazard',
  'Projectile',
  'EnemyAI',
  'PlayerMovement',
  'WaveSpawner',
  'StaticPlatform',
  'MovingPlatform',
  'OneWayPlatform',
  'CrumblingPlatform',
]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function driftRatio(actual: number, suggested: number): number {
  if (suggested === 0) return actual === 0 ? 0 : Infinity;
  return Math.abs(actual - suggested) / Math.abs(suggested);
}

function levelFor(confidence: number): 'info' | 'warning' {
  return confidence >= WARNING_CONFIDENCE ? 'warning' : 'info';
}

function formatMessage(
  level: 'info' | 'warning',
  paramKey: string,
  actual: number,
  suggested: number,
): string {
  const actualDisplay = round(actual);
  const suggestedDisplay = round(suggested);
  if (level === 'warning') {
    const direction = actual > suggested ? '偏高' : '偏低';
    return `专家建议 ${paramKey} ≈ ${suggestedDisplay}，当前 ${actualDisplay} ${direction}`;
  }
  return `市场平均 ${paramKey} = ${suggestedDisplay}，当前 ${actualDisplay}`;
}

/**
 * Look up a numeric value in any module's params that matches the given key.
 * Returns the first hit (module + value) or null when no match exists.
 */
function findParamInModules(
  modules: ReadonlyArray<ModuleConfig>,
  key: string,
): { moduleType: string; value: number } | null {
  for (const mod of modules) {
    const raw = mod.params?.[key];
    if (isFiniteNumber(raw)) {
      return { moduleType: mod.type, value: raw };
    }
  }
  return null;
}

/**
 * Resolve a scene-level metric (object_count, collider_count, ...) to a
 * measurement derived from the config. Returns null when the metric is not
 * supported so the caller can skip it.
 */
function resolveSceneMetric(
  key: string,
  config: GameConfig,
): { moduleType: string; value: number } | null {
  if (key === 'object_count') {
    return { moduleType: 'scene', value: config.modules.length };
  }
  if (key === 'collider_count') {
    const count = config.modules.filter((m) =>
      COLLIDER_MODULE_TYPES.has(m.type),
    ).length;
    return { moduleType: 'scene', value: count };
  }
  return null;
}

function resolveSignatureValue(
  key: string,
  config: GameConfig,
): { moduleType: string; value: number } | null {
  const direct = findParamInModules(config.modules, key);
  if (direct) return direct;
  return resolveSceneMetric(key, config);
}

/**
 * Compare a GameConfig against the signatureParams of the expert card for the
 * given game type. Returns up to MAX_ADVICE drift advice entries. Pure — does
 * not mutate inputs and does not touch any store.
 */
export async function detectSignatureDrift(
  config: GameConfig,
  gameType: string,
  loader: SkillLoader = new SkillLoader(),
): Promise<PresetAdvice[]> {
  const card = await loader.loadExpertCardRaw(gameType);
  if (!card) return [];

  const signatureParams = card.signatureParams;
  if (!signatureParams || Object.keys(signatureParams).length === 0) {
    return [];
  }

  const advice: PresetAdvice[] = [];

  for (const [paramKey, spec] of Object.entries(signatureParams)) {
    if (advice.length >= MAX_ADVICE) break;
    if (!spec || spec.confidence < MIN_CONFIDENCE) continue;

    const resolved = resolveSignatureValue(paramKey, config);
    if (!resolved) continue;

    const drift = driftRatio(resolved.value, spec.suggested);
    if (drift <= DRIFT_THRESHOLD) continue;

    const level = levelFor(spec.confidence);
    advice.push({
      level,
      moduleType: resolved.moduleType,
      paramKey,
      actualValue: resolved.value,
      suggestedValue: spec.suggested,
      confidence: spec.confidence,
      message: formatMessage(level, paramKey, resolved.value, spec.suggested),
    });
  }

  return advice;
}
