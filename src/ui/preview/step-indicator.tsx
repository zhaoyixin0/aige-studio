import type { PreviewPhase } from '@/store/editor-store.ts';

const STEPS: readonly { key: PreviewPhase; label: string }[] = [
  { key: 'tuning', label: '调式状态' },
  { key: 'playing', label: '游戏状态' },
  { key: 'success', label: '成功' },
  { key: 'fail', label: '失败' },
] as const;

interface StepIndicatorProps {
  readonly phase: PreviewPhase;
}

/**
 * 4-step progress indicator for the preview area.
 * Matches Figma bottom bar: 调式状态 → 游戏状态 → 成功 → 失败.
 */
export function StepIndicator({ phase }: StepIndicatorProps) {
  const activeIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <div className="flex items-center justify-between px-10 py-3" data-testid="step-indicator">
      {STEPS.map((step, i) => {
        const isActive = step.key === phase;
        const isPast = i < activeIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-16 h-px mx-2 ${isPast ? 'bg-blue-400' : 'bg-white/10'}`}
                aria-hidden="true"
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'size-3 rounded-full transition-colors',
                  isActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]' : '',
                  isPast ? 'bg-blue-400/60' : '',
                  !isActive && !isPast ? 'bg-white/20' : '',
                ].join(' ')}
                aria-hidden="true"
              />
              <span
                className={[
                  'text-xs whitespace-nowrap transition-opacity',
                  isActive ? 'text-white' : 'text-white/40',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
