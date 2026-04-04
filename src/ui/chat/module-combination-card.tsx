import type { ModuleTuningPayload } from '@/store/editor-store';
import { ParameterPill } from './parameter-pill';
import { ExpertInsightBlock } from './expert-insight-block';

// Re-export for backward compat
export type ModuleTuning = ModuleTuningPayload;

interface ModuleCombinationCardProps {
  readonly tuning: ModuleTuningPayload;
  readonly onApply: () => void;
}

export function ModuleCombinationCard({ tuning, onApply }: ModuleCombinationCardProps) {
  return (
    <ExpertInsightBlock title={tuning.title}>
      <div className="flex flex-col gap-2">
        {tuning.modules.map((mod) => (
          <div key={mod.name} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-200">{mod.name}</span>
            <div className="flex flex-wrap gap-1">
              {mod.params.map((p) => (
                <ParameterPill key={p.name} name={p.name} value={p.value} />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onApply}
          className="mt-1 self-start px-3 py-1 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          应用专家调参
        </button>
      </div>
    </ExpertInsightBlock>
  );
}
