import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import type { ModuleSchema, SchemaField } from '@/engine/core/types.ts';

interface SchemaRendererProps {
  schema: ModuleSchema;
  values: Record<string, unknown>;
  onChange: (param: string, value: unknown) => void;
}

export function SchemaRenderer({ schema, values, onChange }: SchemaRendererProps) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(schema).map(([key, field]) => (
        <FieldRenderer
          key={key}
          fieldKey={key}
          field={field}
          value={values[key] ?? field.default}
          onChange={(value) => onChange(key, value)}
        />
      ))}
    </div>
  );
}

interface FieldRendererProps {
  fieldKey: string;
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ fieldKey, field, value, onChange }: FieldRendererProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400" htmlFor={fieldKey}>
        {field.label}
        {field.unit && (
          <span className="ml-1 text-gray-500">({field.unit})</span>
        )}
      </label>
      {renderControl(fieldKey, field, value, onChange)}
    </div>
  );
}

function renderControl(
  fieldKey: string,
  field: SchemaField,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  switch (field.type) {
    case 'range':
      return <RangeControl fieldKey={fieldKey} field={field} value={value} onChange={onChange} />;
    case 'number':
      return <NumberControl fieldKey={fieldKey} field={field} value={value} onChange={onChange} />;
    case 'boolean':
      return <BooleanControl value={value} onChange={onChange} />;
    case 'select':
      return <SelectControl fieldKey={fieldKey} field={field} value={value} onChange={onChange} />;
    case 'color':
      return <ColorControl fieldKey={fieldKey} value={value} onChange={onChange} />;
    case 'string':
      return <TextControl fieldKey={fieldKey} value={value} onChange={onChange} />;
    case 'object':
      return <ObjectControl fieldKey={fieldKey} field={field} value={value} onChange={onChange} />;
    case 'rect':
      return <RectControl value={value} onChange={onChange} />;
    case 'asset[]':
      return <AssetListControl value={value} onChange={onChange} />;
    case 'collision-rules':
      return <CollisionRulesControl value={value} />;
    default:
      return <FallbackControl value={value} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Range — slider + number input                                      */
/* ------------------------------------------------------------------ */
function RangeControl({ fieldKey, field, value, onChange }: { fieldKey: string; field: SchemaField; value: unknown; onChange: (v: unknown) => void }) {
  const num = Number(value ?? field.min ?? 0);
  return (
    <div className="flex items-center gap-2">
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[num]}
        min={field.min ?? 0}
        max={field.max ?? 100}
        step={field.step ?? 1}
        onValueChange={([v]) => onChange(v)}
      >
        <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
          <Slider.Range className="absolute bg-blue-500 rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-3.5 h-3.5 bg-white rounded-full shadow-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Slider.Root>
      <input
        id={fieldKey}
        type="number"
        className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-right tabular-nums focus:outline-none focus:border-blue-500"
        value={num.toFixed(field.step && field.step < 1 ? 1 : 0)}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Number input                                                       */
/* ------------------------------------------------------------------ */
function NumberControl({ fieldKey, field, value, onChange }: { fieldKey: string; field: SchemaField; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <input
      id={fieldKey}
      type="number"
      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
      value={Number(value ?? 0)}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Boolean toggle                                                     */
/* ------------------------------------------------------------------ */
function BooleanControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  return (
    <Switch.Root
      checked={Boolean(value)}
      onCheckedChange={(checked) => onChange(checked)}
      className="w-9 h-5 bg-white/10 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors"
    >
      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
    </Switch.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Select dropdown                                                    */
/* ------------------------------------------------------------------ */
function SelectControl({ fieldKey, field, value, onChange }: { fieldKey: string; field: SchemaField; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <select
      id={fieldKey}
      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    >
      {field.options?.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Color picker                                                       */
/* ------------------------------------------------------------------ */
function ColorControl({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={fieldKey}
        type="color"
        className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
        value={String(value ?? '#000000')}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-xs text-gray-400">{String(value ?? '#000000')}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Text input                                                         */
/* ------------------------------------------------------------------ */
function TextControl({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <input
      id={fieldKey}
      type="text"
      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Object — e.g. speed: {min, max} or combo: {enabled, window, ...}  */
/* ------------------------------------------------------------------ */
function ObjectControl({ fieldKey, field, value, onChange }: { fieldKey: string; field: SchemaField; value: unknown; onChange: (v: unknown) => void }) {
  const obj = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;

  // If schema defines sub-fields, render them individually
  if (field.fields) {
    return (
      <div className="pl-3 border-l-2 border-white/10 flex flex-col gap-2">
        {Object.entries(field.fields).map(([subKey, subField]) => (
          <FieldRenderer
            key={`${fieldKey}.${subKey}`}
            fieldKey={`${fieldKey}.${subKey}`}
            field={subField}
            value={obj[subKey] ?? subField.default}
            onChange={(v) => onChange({ ...obj, [subKey]: v })}
          />
        ))}
      </div>
    );
  }

  // Auto-detect common patterns
  if ('min' in obj && 'max' in obj && Object.keys(obj).length <= 2) {
    return <MinMaxControl value={obj} onChange={onChange} />;
  }

  // Generic: render each key as a number/text input
  return (
    <div className="pl-3 border-l-2 border-white/10 flex flex-col gap-2">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-12 shrink-0">{k}</span>
          {typeof v === 'number' ? (
            <input
              type="number"
              className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
              value={v}
              onChange={(e) => onChange({ ...obj, [k]: Number(e.target.value) })}
            />
          ) : typeof v === 'boolean' ? (
            <Switch.Root
              checked={v}
              onCheckedChange={(checked) => onChange({ ...obj, [k]: checked })}
              className="w-8 h-4 bg-white/10 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors"
            >
              <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[16px]" />
            </Switch.Root>
          ) : (
            <input
              type="text"
              className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
              value={String(v ?? '')}
              onChange={(e) => onChange({ ...obj, [k]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Min/Max dual slider — for speed: {min, max}                        */
/* ------------------------------------------------------------------ */
function MinMaxControl({ value, onChange }: { value: Record<string, unknown>; onChange: (v: unknown) => void }) {
  const min = Number(value.min ?? 0);
  const max = Number(value.max ?? 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-8">Min</span>
        <input
          type="number"
          className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
          value={min}
          onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
        />
        <Slider.Root
          className="relative flex items-center select-none touch-none flex-1 h-4"
          value={[min]}
          min={0}
          max={1000}
          step={10}
          onValueChange={([v]) => onChange({ ...value, min: v })}
        >
          <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-blue-500 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow-md" />
        </Slider.Root>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-8">Max</span>
        <input
          type="number"
          className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
          value={max}
          onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
        />
        <Slider.Root
          className="relative flex items-center select-none touch-none flex-1 h-4"
          value={[max]}
          min={0}
          max={1000}
          step={10}
          onValueChange={([v]) => onChange({ ...value, max: v })}
        >
          <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-blue-500 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow-md" />
        </Slider.Root>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rect — x, y, width, height                                        */
/* ------------------------------------------------------------------ */
function RectControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const rect = (typeof value === 'object' && value !== null ? value : { x: 0, y: 0, width: 800, height: 0 }) as Record<string, number>;
  const fields = [
    { key: 'x', label: 'X' },
    { key: 'y', label: 'Y' },
    { key: 'width', label: 'W' },
    { key: 'height', label: 'H' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {fields.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 w-4">{label}</span>
          <input
            type="number"
            className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
            value={rect[key] ?? 0}
            min={0}
            onChange={(e) => onChange({ ...rect, [key]: Number(e.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset list — items: [{asset, weight}, ...]                         */
/* ------------------------------------------------------------------ */
function AssetListControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const items = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
          <span className="text-xs text-gray-300 flex-1 truncate">{String(item.asset ?? item.label ?? `Item ${i + 1}`)}</span>
          <span className="text-[10px] text-gray-500">x</span>
          <input
            type="number"
            className="w-10 bg-white/10 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white text-center focus:outline-none focus:border-blue-500"
            value={Number(item.weight ?? 1)}
            min={0}
            step={1}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = { ...item, weight: Number(e.target.value) };
              onChange(updated);
            }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-gray-500 hover:text-red-400 text-xs px-1"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { asset: 'new_item', weight: 1 }])}
        className="text-[10px] text-blue-400 hover:text-blue-300 self-start"
      >
        + Add Item
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collision rules — read-only display                                */
/* ------------------------------------------------------------------ */
function CollisionRulesControl({ value }: { value: unknown }) {
  const rules = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
  return (
    <div className="flex flex-col gap-1">
      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-1 text-[10px] text-gray-400 bg-white/5 rounded px-2 py-1">
          <span className="text-blue-400">{String(rule.a)}</span>
          <span>↔</span>
          <span className="text-green-400">{String(rule.b)}</span>
          <span>→</span>
          <span className="text-yellow-400">{String(rule.event)}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback — JSON display for unknown types                          */
/* ------------------------------------------------------------------ */
function FallbackControl({ value }: { value: unknown }) {
  const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '');
  return (
    <pre className="text-[10px] text-gray-400 bg-white/5 rounded p-2 overflow-auto max-h-24 whitespace-pre-wrap break-all">
      {display}
    </pre>
  );
}
