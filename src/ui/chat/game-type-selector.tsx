import { useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GameTypeOption {
  readonly id: string;
  readonly name: string;
  readonly emoji?: string;
}

export interface GameTypeSelectorProps {
  readonly options: readonly GameTypeOption[];
  readonly onSelect: (gameTypeId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  GameTypeCard                                                       */
/* ------------------------------------------------------------------ */

interface CardProps {
  readonly option: GameTypeOption;
  readonly isHovered: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onConfirm: (id: string) => void;
}

function GameTypeCard({ option, isHovered, onHover, onConfirm }: CardProps) {
  const baseClasses =
    'flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-200 border cursor-pointer';
  const stateClasses = isHovered
    ? 'bg-blue-500/15 border-blue-400 shadow-lg shadow-blue-500/10'
    : 'bg-white/5 border-white/10 hover:bg-white/8';

  return (
    <div
      role="group"
      aria-label={option.name}
      data-testid="game-type-card"
      className={`${baseClasses} ${stateClasses}`}
      onMouseEnter={() => onHover(option.id)}
      onMouseLeave={() => onHover(null)}
    >
      {option.emoji && (
        <span className="text-3xl leading-none">{option.emoji}</span>
      )}
      <span className="text-sm text-gray-200 text-center font-medium">
        {option.name}
      </span>
      <button
        type="button"
        aria-label={`确定选择${option.name}`}
        onClick={() => onConfirm(option.id)}
        className="mt-1 px-4 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        确定
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GameTypeSelector                                                   */
/* ------------------------------------------------------------------ */

export function GameTypeSelector({ options, onSelect }: GameTypeSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const handleConfirm = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );

  if (options.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 p-3">
      {options.map((option) => (
        <GameTypeCard
          key={option.id}
          option={option}
          isHovered={hoveredId === option.id}
          onHover={handleHover}
          onConfirm={handleConfirm}
        />
      ))}
    </div>
  );
}
