import { useEditorStore } from '@/store/editor-store';
import type { Chip, ChipType } from '@/store/editor-store';

const selectChips = (s: { suggestionChips: Chip[] }) => s.suggestionChips;
const selectSetBoardModeOpen = (s: { setBoardModeOpen: (open: boolean) => void }) =>
  s.setBoardModeOpen;

interface Props {
  onChipClick: (chip: Chip) => void;
}

const BASE_CLASSES =
  'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both';

const STYLE_BY_TYPE: Record<ChipType, string> = {
  game_type:
    'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white',
  board_mode:
    'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 hover:border-blue-400/50 text-blue-300 hover:text-blue-100',
  param:
    'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 hover:border-amber-400/50 text-amber-300 hover:text-amber-100',
  action:
    'bg-green-500/10 hover:bg-green-500/20 border border-green-400/30 hover:border-green-400/50 text-green-300 hover:text-green-100',
};

function chipClasses(type: ChipType): string {
  return `${BASE_CLASSES} ${STYLE_BY_TYPE[type]}`;
}

export function SuggestionChips({ onChipClick }: Props) {
  const chips = useEditorStore(selectChips);
  const setBoardModeOpen = useEditorStore(selectSetBoardModeOpen);

  if (chips.length === 0) return null;

  const handleClick = (chip: Chip): void => {
    if (chip.type === 'board_mode') {
      setBoardModeOpen(true);
      return;
    }
    onChipClick(chip);
  };

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 justify-center">
      {chips.map((chip, index) => (
        <button
          key={chip.id}
          onClick={() => handleClick(chip)}
          className={chipClasses(chip.type ?? 'game_type')}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {chip.emoji && <span className="text-base">{chip.emoji}</span>}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
