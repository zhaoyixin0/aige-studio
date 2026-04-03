import { useCallback } from 'react';

export interface SegmentedControlProps {
  readonly options: readonly string[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
}

export function SegmentedControl({ options, value, onChange, label }: SegmentedControlProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = options.indexOf(value);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, options.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      if (nextIndex !== null && nextIndex !== currentIndex) {
        onChange(options[nextIndex]);
      }
    },
    [options, value, onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg bg-white/5 p-0.5 gap-0.5"
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => {
        const isSelected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option}
            tabIndex={isSelected ? 0 : -1}
            className={`
              px-3 py-1 text-xs font-medium rounded-md transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-transparent
              ${isSelected
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
              }
            `}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
