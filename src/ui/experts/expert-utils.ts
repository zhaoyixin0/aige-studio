// src/ui/experts/expert-utils.ts
// Pure utility functions for expert preset metadata parsing.
// All UI components access expert data through here to avoid engine coupling.

import type { PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';

export type ConfidenceTier = 'high' | 'medium' | 'low';

/** Parse confidence value from a preset's tags array (e.g., "confidence:0.75" → 0.75). */
export function parseConfidence(tags: readonly string[]): number | null {
  const tag = tags.find((t) => t.startsWith('confidence:'));
  if (!tag) return null;
  const value = parseFloat(tag.slice('confidence:'.length));
  return Number.isFinite(value) ? value : null;
}

/** Extract source filename from preset description "[source: X]". */
export function extractSource(preset: PresetTemplate): string | null {
  const match = preset.description?.match(/\[source:\s*([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/** Count required modules for a preset. */
export function countModules(preset: PresetTemplate): number {
  return preset.requiredModules?.length ?? 0;
}

/** Group expert presets by gameType. */
export function groupByGameType(
  presets: readonly PresetTemplate[],
): Map<string, readonly PresetTemplate[]> {
  const map = new Map<string, PresetTemplate[]>();
  for (const p of presets) {
    const gt = p.gameType ?? 'unknown';
    const arr = map.get(gt) ?? [];
    map.set(gt, [...arr, p]);
  }
  return map;
}

/** Count expert presets per gameType. */
export function countByGameType(
  presets: readonly PresetTemplate[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of presets) {
    const gt = p.gameType ?? 'unknown';
    map.set(gt, (map.get(gt) ?? 0) + 1);
  }
  return map;
}

/** Get top N presets sorted by confidence descending, with id as tiebreaker. */
export function topByConfidence(
  presets: readonly PresetTemplate[],
  n: number,
): readonly PresetTemplate[] {
  return [...presets]
    .sort((a, b) => {
      const ca = parseConfidence(a.tags) ?? 0;
      const cb = parseConfidence(b.tags) ?? 0;
      if (cb !== ca) return cb - ca;
      return a.id.localeCompare(b.id);
    })
    .slice(0, n);
}

/** Pick a random featured preset, weighted by confidence. */
export function pickFeatured(
  presets: readonly PresetTemplate[],
): PresetTemplate | null {
  if (presets.length === 0) return null;

  const weighted = presets.map((p) => ({
    preset: p,
    weight: parseConfidence(p.tags) ?? 0.5,
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { preset, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return preset;
  }

  return weighted[weighted.length - 1].preset;
}

/** Classify confidence into a color tier. */
export function confidenceTier(value: number): ConfidenceTier {
  if (value >= 0.85) return 'high';
  if (value >= 0.6) return 'medium';
  return 'low';
}

/** CSS class for confidence tier color. */
export function confidenceColor(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high': return 'text-emerald-400';
    case 'medium': return 'text-blue-400';
    case 'low': return 'text-slate-400';
  }
}
