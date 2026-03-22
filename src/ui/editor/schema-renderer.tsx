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
      return (
        <div className="flex items-center gap-2">
          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-5"
            value={[Number(value ?? field.min ?? 0)]}
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
          <span className="text-xs text-gray-400 min-w-[2.5rem] text-right tabular-nums">
            {Number(value ?? 0).toFixed(field.step && field.step < 1 ? 1 : 0)}
          </span>
        </div>
      );

    case 'number':
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

    case 'boolean':
      return (
        <Switch.Root
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          className="w-9 h-5 bg-white/10 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors"
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      );

    case 'select':
      return (
        <select
          id={fieldKey}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'color':
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

    case 'string':
      return (
        <input
          id={fieldKey}
          type="text"
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
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
}
