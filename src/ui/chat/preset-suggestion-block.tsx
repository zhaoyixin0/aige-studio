import { useMemo } from 'react';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';
import {
  parseConfidence,
  extractSource,
  countModules,
  confidenceTier,
  confidenceColor,
} from '@/ui/experts/expert-utils.ts';

interface PresetSuggestionBlockProps {
  readonly presetId: string;
  readonly title: string;
  readonly pendingAssets: number;
}

export function PresetSuggestionBlock({
  presetId,
  title,
  pendingAssets,
}: PresetSuggestionBlockProps) {
  const isExpert = presetId.startsWith('expert-');

  const metadata = useMemo(() => {
    if (!isExpert) return null;
    const preset = EXPERT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;
    const confidence = parseConfidence(preset.tags);
    return {
      source: extractSource(preset),
      confidence,
      tier: confidence != null ? confidenceTier(confidence) : null,
      moduleCount: countModules(preset),
    };
  }, [presetId, isExpert]);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 mt-2" data-preset-id={presetId}>
      <div className="text-sm font-medium text-blue-800">
        {isExpert ? '基于专家模板创建' : '基于模板创建'}
      </div>
      <div className="text-sm text-blue-600 mt-1">
        {title}
      </div>
      {pendingAssets > 0 && (
        <div className="text-xs text-blue-400 mt-1">
          {pendingAssets} 个素材待生成
        </div>
      )}
      {metadata && (
        <div className="text-xs text-blue-400/70 mt-2 flex gap-3" data-testid="expert-metadata">
          <span>来源: {metadata.source ?? '未知'}</span>
          <span className={metadata.tier ? confidenceColor(metadata.tier) : ''}>
            置信度: {metadata.confidence != null ? `${Math.round(metadata.confidence * 100)}%` : '--'}
          </span>
          <span>模块: {metadata.moduleCount}</span>
        </div>
      )}
    </div>
  );
}
