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
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 mt-2" data-preset-id={presetId}>
      <div className="text-sm font-medium text-blue-800">
        基于模板创建
      </div>
      <div className="text-sm text-blue-600 mt-1">
        {title}
      </div>
      {pendingAssets > 0 && (
        <div className="text-xs text-blue-400 mt-1">
          {pendingAssets} 个素材待生成
        </div>
      )}
    </div>
  );
}
