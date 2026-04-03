import { useDeferredValue, useMemo } from 'react';
import {
  getParamsForGameType,
  type ParameterMeta,
  type ParamCategory,
} from '@/data/parameter-registry';
import { resolveVisibility } from '@/engine/core/dependency-resolver';
import { ParamCategoryGroup } from './param-category-group';

export interface BoardModePanelProps {
  readonly gameType: string;
  readonly values: ReadonlyMap<string, unknown>;
  readonly onParamChange: (paramId: string, value: unknown) => void;
  readonly onClose: () => void;
}

const CATEGORY_ORDER: ParamCategory[] = [
  'game_mechanics',
  'game_objects',
  'visual_audio',
  'input',
  'online',
];

export function BoardModePanel({
  gameType,
  values,
  onParamChange,
  onClose,
}: BoardModePanelProps) {
  // Get params applicable to this game type
  const applicableParams = useMemo(
    () => getParamsForGameType(gameType),
    [gameType],
  );

  // Defer visibility recalculation to keep slider input responsive
  const deferredValues = useDeferredValue(values);

  // Resolve visibility based on DAG dependencies
  const visibility = useMemo(
    () => resolveVisibility(applicableParams, deferredValues),
    [applicableParams, deferredValues],
  );

  // Filter: only directly exposed + visible params (not hidden exposure, not DAG-hidden)
  const visibleParams = useMemo(
    () =>
      applicableParams.filter((p) => {
        if (p.exposure === 'hidden') return false;
        const vis = visibility.get(p.id);
        return vis?.visible === true;
      }),
    [applicableParams, visibility],
  );

  // Group by category in defined order
  const groups = useMemo(() => {
    const byCategory = new Map<string, ParameterMeta[]>();
    for (const param of visibleParams) {
      const cat = param.category;
      const arr = byCategory.get(cat) ?? [];
      arr.push(param);
      byCategory.set(cat, arr);
    }

    return CATEGORY_ORDER
      .filter((cat) => byCategory.has(cat))
      .map((cat) => ({
        category: cat,
        params: byCategory.get(cat)!,
      }));
  }, [visibleParams]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">Board Mode</h2>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {groups.map(({ category, params }) => (
          <ParamCategoryGroup
            key={category}
            category={category}
            params={params}
            values={values}
            onParamChange={onParamChange}
          />
        ))}

        {groups.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-8">
            当前游戏类型暂无可调参数
          </p>
        )}
      </div>
    </div>
  );
}
