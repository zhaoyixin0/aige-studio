import { memo, useCallback, useState } from 'react';
import type { ParameterMeta, ParamControlType } from '@/data/parameter-registry';
import { SegmentedControl } from '@/ui/controls/segmented-control';
import { StepperControl } from '@/ui/controls/stepper-control';
import { VisualStyleSelector } from './visual-style-selector';

const CATEGORY_LABELS: Record<string, string> = {
  abstract: '抽象层',
  game_mechanics: '游戏机制',
  game_objects: '游戏对象',
  visual_audio: '视觉音效',
  input: '输入交互',
  online: '联机系统',
};

export interface ParamCategoryGroupProps {
  readonly category: string;
  readonly params: readonly ParameterMeta[];
  readonly values: ReadonlyMap<string, unknown>;
  readonly onParamChange: (paramId: string, value: unknown) => void;
}

/** Custom areEqual: only re-render when this group's specific param values change */
function areEqual(
  prev: ParamCategoryGroupProps,
  next: ParamCategoryGroupProps,
): boolean {
  if (prev.category !== next.category) return false;
  if (prev.onParamChange !== next.onParamChange) return false;
  if (prev.params !== next.params) {
    if (prev.params.length !== next.params.length) return false;
    for (let i = 0; i < prev.params.length; i++) {
      if (prev.params[i] !== next.params[i]) return false;
    }
  }
  // Only compare values that belong to THIS group's params
  for (const p of next.params) {
    if (prev.values.get(p.id) !== next.values.get(p.id)) return false;
  }
  return true;
}

function ParamCategoryGroupInner({
  category,
  params,
  values,
  onParamChange,
}: ParamCategoryGroupProps) {
  const [expanded, setExpanded] = useState(true);

  if (params.length === 0) return null;

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div data-testid="param-category-group" className="flex flex-col">
      <button
        type="button"
        className="flex items-center justify-between py-2 text-xs font-semibold text-gray-300 uppercase tracking-wider hover:text-white transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span>{label}</span>
        <span className="text-gray-500">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 pb-3">
          {params.map((param) => (
            <ParamRow
              key={param.id}
              param={param}
              value={values.get(param.id)}
              onParamChange={onParamChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const ParamCategoryGroup = memo(ParamCategoryGroupInner, areEqual);

// --- Internal ---

interface ParamRowProps {
  readonly param: ParameterMeta;
  readonly value: unknown;
  readonly onParamChange: (paramId: string, value: unknown) => void;
}

function ParamRow({ param, value, onParamChange }: ParamRowProps) {
  const liveValue = value ?? param.defaultValue;

  const handleChange = useCallback(
    (v: unknown) => onParamChange(param.id, v),
    [param.id, onParamChange],
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-400 shrink-0">{param.name}</span>
      <div className="shrink-0">
        <InlineControl param={param} value={liveValue} onChange={handleChange} />
      </div>
    </div>
  );
}

function InlineControl({
  param,
  value,
  onChange,
}: {
  readonly param: ParameterMeta;
  readonly value: unknown;
  readonly onChange: (v: unknown) => void;
}) {
  switch (param.controlType as ParamControlType) {
    case 'toggle':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-label={param.name}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${Boolean(value) ? 'bg-blue-600' : 'bg-white/10'}`}
          onClick={() => onChange(!value)}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${Boolean(value) ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      );
    case 'slider':
      return (
        <input
          type="range"
          aria-label={param.name}
          min={0}
          max={100}
          value={typeof value === 'number' ? value : 50}
          className="w-24 accent-blue-600"
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'segmented':
      return (
        <SegmentedControl
          options={param.options ? [...param.options] : []}
          value={String(value)}
          onChange={onChange}
          label={param.name}
        />
      );
    case 'stepper':
      return (
        <StepperControl
          value={typeof value === 'number' ? value : 0}
          min={0}
          max={100}
          step={1}
          onChange={onChange}
          label={param.name}
        />
      );
    case 'asset_picker': {
      const opts = (param.options ?? []).map((id) => ({ id, name: id }));
      return <VisualStyleSelector options={opts} value={String(value)} onChange={onChange} />;
    }
    case 'input_field':
      return <span className="text-xs text-gray-400 italic">—</span>;
    default:
      return <span className="text-xs text-gray-500">{String(value)}</span>;
  }
}
