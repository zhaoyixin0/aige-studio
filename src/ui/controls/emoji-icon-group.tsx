import { useCallback, useRef } from 'react';

export interface EmojiItem {
  readonly value: string;
  readonly emoji: string;
}

export interface EmojiIconGroupProps {
  readonly items: readonly EmojiItem[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
}

/**
 * Group of emoji icon buttons matching Figma L1 Difficulty design.
 * Selected: white bg. Unselected: #34383c dark bg.
 */
export function EmojiIconGroup({ items, value, onChange, label }: EmojiIconGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = items.findIndex((it) => it.value === value);
      if (idx === -1) return;
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = Math.min(idx + 1, items.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = Math.max(idx - 1, 0);
      } else {
        return;
      }
      e.preventDefault();
      onChange(items[next].value);
      const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
      radios?.[next]?.focus();
    },
    [items, value, onChange],
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label ?? 'Emoji selection'}
      className="flex gap-2"
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={item.value}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={[
              'flex items-center justify-center rounded-xl size-10 text-xl',
              'transition-all duration-200 cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              selected
                ? 'bg-white shadow-md'
                : 'bg-[#34383c] hover:bg-[#3d4246]',
            ].join(' ')}
          >
            <span aria-hidden="true">{item.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
