import { useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import { useEditorStore } from '@/store/editor-store';
import {
  getParamsForGameType,
  type ParamCategory,
} from '@/data/parameter-registry';
import { extractRegistryValueMap } from '@/data/registry-binding';
import { resolveVisibility } from '@/engine/core/dependency-resolver';
import { ParameterPill, type PillColorVariant } from './parameter-pill';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_ORDER: ParamCategory[] = [
  'game_mechanics',
  'game_objects',
  'visual_audio',
  'input',
];

const CATEGORY_LABELS: Record<string, string> = {
  game_mechanics: '游戏机制',
  game_objects: '游戏对象',
  visual_audio: '视觉 / 音频',
  input: '输入',
};

const CATEGORY_VARIANT: Record<string, PillColorVariant> = {
  game_mechanics: 'amber',
  game_objects: 'sky',
  visual_audio: 'fuchsia',
  input: 'emerald',
};

/* ------------------------------------------------------------------ */
/*  Selectors                                                          */
/* ------------------------------------------------------------------ */

const selectConfig = (s: { config: ReturnType<typeof useGameStore.getState>['config'] }) => s.config;
const selectSetBoardModeOpen = (s: { setBoardModeOpen: (open: boolean) => void }) =>
  s.setBoardModeOpen;

/* ------------------------------------------------------------------ */
/*  Value formatting                                                   */
/* ------------------------------------------------------------------ */

function formatValue(value: unknown, defaultValue: unknown): string {
  const v = value ?? defaultValue;
  if (typeof v === 'boolean') return v ? '开' : '关';
  return String(v);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function L3PillsPanel() {
  const config = useGameStore(selectConfig);
  const setBoardModeOpen = useEditorStore(selectSetBoardModeOpen);

  const gameType = config?.meta?.name?.toLowerCase() ?? '';

  const values = useMemo(
    () => (config ? extractRegistryValueMap(config) : new Map<string, unknown>()),
    [config],
  );

  const applicableParams = useMemo(
    () => (config ? getParamsForGameType(gameType) : []),
    [config, gameType],
  );

  const visibility = useMemo(
    () => resolveVisibility(applicableParams, values),
    [applicableParams, values],
  );

  const groups = useMemo(() => {
    const visibleL3 = applicableParams.filter((p) => {
      if (p.layer !== 'L3') return false;
      if (p.exposure === 'hidden') return false;
      const vis = visibility.get(p.id);
      return vis?.visible === true;
    });

    const byCategory = new Map<string, typeof visibleL3>();
    for (const param of visibleL3) {
      const arr = byCategory.get(param.category) ?? [];
      arr.push(param);
      byCategory.set(param.category, arr);
    }

    return CATEGORY_ORDER
      .filter((cat) => byCategory.has(cat))
      .map((cat) => ({
        category: cat,
        params: byCategory.get(cat)!,
      }));
  }, [applicableParams, visibility]);

  if (groups.length === 0) return null;

  return (
    <div data-testid="l3-pills-panel" className="px-4 py-3 space-y-3 border-t border-white/5">
      {groups.map(({ category, params }) => (
        <div key={category}>
          <div
            data-testid="category-heading"
            className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide mb-1.5"
          >
            {CATEGORY_LABELS[category] ?? category}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {params.map((p) => (
              <ParameterPill
                key={p.id}
                name={p.name}
                value={formatValue(values.get(p.id), p.defaultValue)}
                colorVariant={CATEGORY_VARIANT[category] ?? 'blue'}
                onClick={() => setBoardModeOpen(true)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
