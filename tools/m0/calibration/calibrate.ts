// tools/m0/calibration/calibrate.ts
// Empirical-Bayes shrinkage calibration.
// Formula: suggested = (w0 * default + we * expertMedian) / (w0 + we)
// w0 = prior weight (fixed), we = min(n, 20) where n = number of expert data points.

import type { CanonicalParams } from './extract-params';

const PRIOR_WEIGHT = 5;
const MAX_EXPERT_WEIGHT = 20;

export interface GroupStats {
  readonly median: number;
  readonly mad: number; // median absolute deviation
  readonly p10: number;
  readonly p90: number;
  readonly count: number;
}

export interface CalibrationResult {
  readonly suggested: number;
  readonly confidence: number; // 0-1: higher with more data and lower variance
  readonly stats: GroupStats | null;
}

function getNumericValues(params: CanonicalParams[], key: string): number[] {
  const values: number[] = [];
  for (const p of params) {
    const val = p[key as keyof CanonicalParams];
    if (val === undefined || val === null) continue;
    if (typeof val === 'boolean') {
      values.push(val ? 1 : 0);
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      values.push(val);
    }
  }
  return values;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function median(sorted: number[]): number {
  return percentile(sorted, 0.5);
}

export function computeGroupStats(params: CanonicalParams[], key: string): GroupStats | null {
  const values = getNumericValues(params, key);
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const deviations = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = median(deviations);

  return {
    median: med,
    mad,
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    count: values.length,
  };
}

export function calibrate(
  params: CanonicalParams[],
  key: string,
  defaultValue: number,
): CalibrationResult {
  const stats = computeGroupStats(params, key);

  if (!stats || stats.count === 0) {
    return { suggested: defaultValue, confidence: 0, stats: null };
  }

  // Empirical-Bayes shrinkage
  const we = Math.min(stats.count, MAX_EXPERT_WEIGHT);
  const suggested = (PRIOR_WEIGHT * defaultValue + we * stats.median) / (PRIOR_WEIGHT + we);

  // Confidence: higher with more data, lower with higher variance
  const dataConfidence = Math.min(stats.count / MAX_EXPERT_WEIGHT, 1);
  const varianceConfidence =
    stats.median > 0
      ? Math.max(0, 1 - stats.mad / stats.median)
      : stats.mad === 0
        ? 1
        : 0;
  const confidence = Math.round(dataConfidence * varianceConfidence * 1000) / 1000;

  return {
    suggested: Math.round(suggested * 1000) / 1000,
    confidence: Math.max(0, Math.min(1, confidence)),
    stats,
  };
}
