/**
 * PresetEnrichmentBadge — floating indicator that visualizes the
 * usePresetEnrichment hook state.
 *
 * Lifecycle mapping:
 *   idle       → null
 *   running    → "正在基于 skill 优化..." + spinner + "跳过" button
 *   done       → "已优化 N 项" (optionally "N 项保留了你的修改")
 *   failed     → info-level "深度微调不可用，已为你保留基础玩法"
 *   cancelled  → null (silent)
 */
import type { EnrichmentState } from '@/app/hooks/use-preset-enrichment';

interface PresetEnrichmentBadgeProps {
  readonly state: EnrichmentState;
  readonly applied: number;
  readonly skipped: number;
  readonly onCancel: () => void;
}

export function PresetEnrichmentBadge({
  state,
  applied,
  skipped,
  onCancel,
}: PresetEnrichmentBadgeProps): JSX.Element | null {
  if (state === 'idle' || state === 'cancelled') return null;

  if (state === 'running') {
    return (
      <div
        data-testid="preset-enrichment-badge"
        data-state="running"
        className="mx-3 my-2 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-xs text-blue-200"
      >
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"
        />
        <span className="flex-1">正在基于 skill 优化参数...</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-blue-300 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-blue-500/20"
        >
          跳过
        </button>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div
        data-testid="preset-enrichment-badge"
        data-state="done"
        className="mx-3 my-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200"
      >
        <span aria-hidden="true">✓</span>
        <span>已优化 {applied} 项</span>
        {skipped > 0 ? (
          <span className="text-emerald-300/70">
            （{skipped} 项保留了你的修改）
          </span>
        ) : null}
      </div>
    );
  }

  // failed
  return (
    <div
      data-testid="preset-enrichment-badge"
      data-state="failed"
      className="mx-3 my-2 flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-200/80"
    >
      <span aria-hidden="true">i</span>
      <span>深度微调不可用，已为你保留基础玩法</span>
    </div>
  );
}
