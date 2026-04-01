import { useEditorStore } from '@/store/editor-store';
import type { Chip } from '@/store/editor-store';

const selectChips = (s: { suggestionChips: Chip[] }) => s.suggestionChips;

interface Props {
  onChipClick: (chip: Chip) => void;
}

export function SuggestionChips({ onChipClick }: Props) {
  const chips = useEditorStore(selectChips);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 justify-center">
      {chips.map((chip, index) => (
        <button
          key={chip.id}
          onClick={() => onChipClick(chip)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm text-gray-300 hover:text-white transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {chip.emoji && <span className="text-base">{chip.emoji}</span>}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
