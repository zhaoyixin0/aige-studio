import { useCallback, useMemo } from 'react';
import { getParamById } from '@/data/parameter-registry';
import type { ParameterMeta, ParamControlType } from '@/data/parameter-registry';
import { SegmentedControl } from '@/ui/controls/segmented-control';
import { StepperControl } from '@/ui/controls/stepper-control';
import { AssetPickerGrid } from '@/ui/controls/asset-picker-grid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GuiParamCardProps {
  readonly category: string;
  readonly paramIds: readonly string[];
  readonly title?: string;
  readonly isActive: boolean;
  readonly values?: Readonly<Record<string, unknown>>;
  readonly onParamChange?: (paramId: string, value: unknown) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GuiParamCard({
  category,
  paramIds,
  title,
  isActive,
  values = {},
  onParamChange,
}: GuiParamCardProps) {
  const resolvedParams = useMemo(
    () =>
      paramIds
        .map((id) => getParamById(id))
        .filter((p): p is ParameterMeta => p !== undefined),
    [paramIds],
  );

  if (resolvedParams.length === 0) return null;

  const displayTitle = title ?? categoryLabel(category);

  if (!isActive) {
    return (
      <TombstoneCard
        title={displayTitle}
        params={resolvedParams}
        values={values}
      />
    );
  }

  return (
    <div
      data-testid="gui-param-card"
      className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-3"
    >
      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
        {displayTitle}
      </h3>
      <div className="flex flex-col gap-2.5">
        {resolvedParams.map((param) => (
          <ParamRow
            key={param.id}
            param={param}
            value={values[param.id]}
            onParamChange={onParamChange}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tombstone (collapsed read-only summary)                            */
/* ------------------------------------------------------------------ */

export interface TombstoneCardProps {
  readonly title: string;
  readonly params: readonly ParameterMeta[];
  readonly values?: Readonly<Record<string, unknown>>;
}

export function TombstoneCard({ title, params, values = {} }: TombstoneCardProps) {
  const summary = params
    .map((p) => `${p.name}=${formatDefaultValue(values[p.id] ?? p.defaultValue)}`)
    .join(', ');

  return (
    <div
      data-testid="gui-param-card"
      className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-xs text-gray-500"
    >
      <span className="font-medium text-gray-400">{title}:</span>{' '}
      {summary}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Parameter Row — label + control                                    */
/* ------------------------------------------------------------------ */

export interface ParamRowProps {
  readonly param: ParameterMeta;
  readonly value?: unknown;
  readonly onParamChange?: (paramId: string, value: unknown) => void;
}

export function ParamRow({ param, value, onParamChange }: ParamRowProps) {
  const handleChange = useCallback(
    (value: unknown) => onParamChange?.(param.id, value),
    [param.id, onParamChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400">
        {param.name}
      </label>
      <ParamControl param={param} value={value} onChange={handleChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Control dispatcher                                                 */
/* ------------------------------------------------------------------ */

interface ParamControlProps {
  readonly param: ParameterMeta;
  readonly value?: unknown;
  readonly onChange: (value: unknown) => void;
}

function ParamControl({ param, value, onChange }: ParamControlProps) {
  // Use live value if provided, fall back to registry default
  const liveValue = value ?? param.defaultValue;

  switch (param.controlType as ParamControlType) {
    case 'toggle':
      return (
        <ToggleControl
          checked={Boolean(liveValue)}
          label={param.name}
          onChange={onChange}
        />
      );
    case 'slider':
      return (
        <SliderControl
          value={typeof liveValue === 'number' ? liveValue : 50}
          label={param.name}
          onChange={onChange}
        />
      );
    case 'segmented':
      return (
        <SegmentedControl
          options={param.options ? [...param.options] : []}
          value={String(liveValue)}
          onChange={onChange}
          label={param.name}
        />
      );
    case 'stepper':
      return (
        <StepperControl
          value={typeof liveValue === 'number' ? liveValue : Number(liveValue) || 0}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onChange(v)}
          label={param.name}
        />
      );
    case 'asset_picker':
      return (
        <AssetPickerGrid
          assets={(param.options ?? []).map((opt) => ({
            id: opt,
            thumbnail: '',
            label: opt,
          }))}
          value={String(liveValue)}
          onChange={onChange}
          label={param.name}
        />
      );
    case 'input_field':
      return (
        <InputFieldControl
          value={String(liveValue ?? '')}
          label={param.name}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Individual controls                                                */
/* ------------------------------------------------------------------ */

function ToggleControl({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (value: unknown) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        ${checked ? 'bg-blue-600' : 'bg-white/10'}
      `}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white transition-transform
          ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

function SliderControl({
  value,
  label,
  onChange,
}: {
  readonly value: number;
  readonly label: string;
  readonly onChange: (value: unknown) => void;
}) {
  return (
    <input
      type="range"
      role="slider"
      aria-label={label}
      min={0}
      max={100}
      value={value}
      className="w-full accent-blue-600"
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function InputFieldControl({
  value,
  label,
  onChange,
}: {
  readonly value: string;
  readonly label: string;
  readonly onChange: (value: unknown) => void;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value}
      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function formatDefaultValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? '开启' : '关闭';
  return String(value);
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    abstract: '抽象层',
    game_mechanics: '游戏机制',
    game_objects: '游戏对象',
    visual_audio: '视觉与音频',
    input: '输入',
    online: '联机',
  };
  return labels[category] ?? category;
}
