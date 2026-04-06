import type { PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';
import { GAME_TYPE_META } from '@/agent/game-presets.ts';
import {
  parseConfidence,
  extractSource,
  countModules,
  confidenceTier,
  confidenceColor,
} from './expert-utils.ts';

interface ExpertPresetCardProps {
  readonly preset: PresetTemplate;
  readonly onUse: (presetId: string) => void;
}

export function ExpertPresetCard({ preset, onUse }: ExpertPresetCardProps) {
  const confidence = parseConfidence(preset.tags);
  const source = extractSource(preset);
  const moduleCount = countModules(preset);
  const tier = confidence != null ? confidenceTier(confidence) : null;
  const meta = preset.gameType ? GAME_TYPE_META[preset.gameType as keyof typeof GAME_TYPE_META] : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4 bg-white/5 border border-white/10
        hover:bg-white/8 hover:border-white/20 hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer"
      data-testid="expert-preset-card"
      data-preset-id={preset.id}
    >
      {/* Header: title + game type badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-200 line-clamp-1">
          {preset.title}
        </h3>
        {meta && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300">
            {meta.emoji} {meta.displayName}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 line-clamp-2">
        {preset.description}
      </p>

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        {source && <span>来源: {source}</span>}
        {confidence != null && (
          <span className={tier ? confidenceColor(tier) : ''}>
            置信度: {Math.round(confidence * 100)}%
          </span>
        )}
        <span>模块: {moduleCount}</span>
      </div>

      {/* Use button */}
      <button
        type="button"
        onClick={() => onUse(preset.id)}
        className="mt-auto px-3 py-1.5 rounded-lg text-xs font-medium
          bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        aria-label={`使用模板 ${preset.title}`}
      >
        使用此模板
      </button>
    </div>
  );
}
