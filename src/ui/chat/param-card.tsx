import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { useGameStore } from '@/store/game-store';
import { type ChatBlock, type ParamCardField } from '@/agent/conversation-defs';
import { RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { dispatchUIAction } from './ui-action-executor';

interface ParamCardProps {
  block: Extract<ChatBlock, { kind: 'param-card' }>;
  disabled?: boolean;
}

export function ParamCard({ block, disabled }: ParamCardProps) {
  const updateModuleParamLive = useGameStore((s) => s.updateModuleParamLive);

  const handleParamChange = (key: string, value: unknown) => {
    if (key.includes(':')) {
      const [moduleType, paramKey] = key.split(':');
      const config = useGameStore.getState().config;
      // Find the first module of this type
      const module = config?.modules.find(m => m.type === moduleType);
      if (module) {
        updateModuleParamLive(module.id, paramKey, value);
      }
    } else {
      // Fallback for special keys like 'duration' which maps to Timer:duration
      if (key === 'duration') {
        const config = useGameStore.getState().config;
        const module = config?.modules.find(m => m.type === 'Timer');
        if (module) {
          updateModuleParamLive(module.id, 'duration', value);
        }
      }
    }
  };

  const disabledClass = disabled ? ' pointer-events-none opacity-50' : '';

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300${disabledClass}`}>
      {block.title && (
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
          {block.title}
        </div>
      )}
      <div className="space-y-3">
        {block.fields.map((field, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-400">{field.label}</label>
              {field.kind === 'slider' && (
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {field.value}{field.unit}
                </span>
              )}
            </div>
            {renderField(field, handleParamChange)}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderField(field: ParamCardField, onChange: (key: string, value: unknown) => void) {
  switch (field.kind) {
    case 'slider':
      return (
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[field.value ?? field.min ?? 0]}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onValueChange={([v]) => onChange(field.key, v)}
        >
          <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-blue-500 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3.5 h-3.5 bg-white rounded-full shadow-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
        </Slider.Root>
      );
    case 'toggle':
      return (
        <Switch.Root
          checked={Boolean(field.value)}
          onCheckedChange={(checked) => onChange(field.key, checked)}
          className="w-9 h-5 bg-white/10 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors"
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      );
    case 'asset':
      return <AssetField field={field} />;
    default:
      return null;
  }
}

function AssetField({ field }: { field: Extract<ParamCardField, { kind: 'asset' }> }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-black/20 border border-white/5 rounded-lg group">
      <div className="w-10 h-10 rounded-md border border-white/10 bg-white/5 overflow-hidden flex-shrink-0">
        {field.thumbnail ? (
          <img src={field.thumbnail} alt={field.label} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <ImageIcon size={16} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white/50 truncate font-mono">{field.key}</div>
      </div>
      <div className="flex gap-1">
        {/* Actions will be implemented in UIActionExecutor */}
        <button 
          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 transition-colors" 
          title="重新生成"
          onClick={() => dispatchUIAction({ type: 'REQUEST_ASSETS_GENERATE', keys: [field.key], showPreview: true })}
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
          title="更换"
          onClick={() => dispatchUIAction({ type: 'REQUEST_ASSET_REPLACE', target: field.key, accept: field.accept ?? ['image'] })}
        >
          <Upload size={14} />
        </button>
      </div>
    </div>
  );
}
