import { useCallback } from 'react';

export interface StepperControlProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly label?: string;
}

export function StepperControl({ value, min, max, step, onChange, label }: StepperControlProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  const handleIncrement = useCallback(() => {
    onChange(Math.min(value + step, max));
  }, [value, step, max, onChange]);

  const handleDecrement = useCallback(() => {
    onChange(Math.max(value - step, min));
  }, [value, step, min, onChange]);

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-1 py-0.5"
    >
      <button
        type="button"
        aria-label={label ? `Decrement ${label}` : 'Decrement'}
        disabled={atMin}
        onClick={handleDecrement}
        className={`
          w-7 h-7 flex items-center justify-center rounded-md text-sm font-bold transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${atMin
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        −
      </button>

      <span
        className="min-w-[2rem] text-center text-sm font-medium text-white tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>

      <button
        type="button"
        aria-label={label ? `Increment ${label}` : 'Increment'}
        disabled={atMax}
        onClick={handleIncrement}
        className={`
          w-7 h-7 flex items-center justify-center rounded-md text-sm font-bold transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${atMax
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        +
      </button>
    </div>
  );
}
