// Runtime overlay loader — merges expert calibrations into game presets immutably.
// Only applies overlay params where confidence >= CONFIDENCE_THRESHOLD.

import type { GamePreset } from './game-presets.ts';

export interface OverlayEntry {
  readonly gameType: string;
  readonly source: string;
  readonly params: Readonly<Record<string, Record<string, unknown>>>;
}

const CONFIDENCE_THRESHOLD = 0.6;

// Eager glob: resolved at Vite build time (empty object if file missing)
const overlayGlob = import.meta.glob(
  '/src/knowledge/overlays/presets.overlay.json',
  { eager: true, import: 'default' },
);

function buildOverlayMap(): ReadonlyMap<string, OverlayEntry> {
  const map = new Map<string, OverlayEntry>();
  const raw = Object.values(overlayGlob)[0] as OverlayEntry[] | undefined;
  if (!Array.isArray(raw)) return map;
  for (const entry of raw) {
    map.set(entry.gameType, entry);
  }
  return map;
}

const OVERLAY_MAP = buildOverlayMap();

function extractConfidentParams(
  params: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    if (key.endsWith('Confidence')) continue;
    const confidence = params[`${key}Confidence`];
    if (typeof confidence === 'number' && confidence >= CONFIDENCE_THRESHOLD) {
      result[key] = params[key];
    }
  }
  return result;
}

export function mergePresetWithOverlay(
  base: GamePreset,
  gameType: string,
): GamePreset {
  const overlay = OVERLAY_MAP.get(gameType);
  if (!overlay) return base;

  const merged = structuredClone(base) as Record<string, Record<string, unknown>>;

  for (const [moduleKey, moduleParams] of Object.entries(overlay.params)) {
    if (typeof moduleParams !== 'object' || moduleParams === null) continue;
    const confident = extractConfidentParams(moduleParams as Record<string, unknown>);
    if (Object.keys(confident).length === 0) continue;

    merged[moduleKey] = {
      ...(merged[moduleKey] ?? {}),
      ...confident,
    };
  }

  return merged as unknown as GamePreset;
}
