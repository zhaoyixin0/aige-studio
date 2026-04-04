import type { GameFeelSuggestion } from '@/store/editor-store';

interface GameFeelSuggestionsProps {
  readonly suggestions: readonly GameFeelSuggestion[];
  readonly onApply: (id: string) => void;
}

export function GameFeelSuggestions({ suggestions, onApply }: GameFeelSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-200 truncate">{s.title}</p>
            <p className="text-[10px] text-gray-500 truncate">{s.description}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-green-400">
            +{s.delta}
          </span>
          <button
            type="button"
            onClick={() => onApply(s.id)}
            className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            Apply
          </button>
        </div>
      ))}
    </div>
  );
}
