import { useCallback, useRef } from 'react';

export interface StyleOption {
  readonly id: string;
  readonly name: string;
  readonly thumbnail?: string;
}

export interface VisualStyleSelectorProps {
  readonly options: readonly StyleOption[];
  readonly value: string;
  readonly onChange: (styleId: string) => void;
}

export function VisualStyleSelector({
  options,
  value,
  onChange,
}: VisualStyleSelectorProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (id: string) => {
      if (id !== value) {
        onChange(id);
      }
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex = index;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = (index + 1) % options.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = (index - 1 + options.length) % options.length;
      } else {
        return;
      }
      e.preventDefault();
      onChange(options[nextIndex].id);
      const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
      radios?.[nextIndex]?.focus();
    },
    [options, onChange],
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="视觉风格"
      className="flex gap-2"
    >
      {options.map((opt, i) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => handleSelect(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={[
              'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer',
              'border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              selected
                ? 'border-blue-500 bg-blue-500/20 text-white'
                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10',
            ].join(' ')}
          >
            {opt.thumbnail && (
              <span className="text-2xl leading-none" aria-hidden="true">
                {opt.thumbnail}
              </span>
            )}
            <span>{opt.name}</span>
          </button>
        );
      })}
    </div>
  );
}
