import { useCallback, useRef } from 'react';

export interface StyleItem {
  readonly id: string;
  readonly label: string;
  readonly thumbnail?: string;
  readonly gradient?: string;
}

export interface StyleCarouselProps {
  readonly items: readonly StyleItem[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly label?: string;
}

/**
 * Horizontal scrolling carousel of 115x115px style cards.
 * Matches Figma L1 Game Styles design: selected card has 3px white border.
 */
export function StyleCarousel({ items, value, onChange, label }: StyleCarouselProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let next = index;
      if (e.key === 'ArrowRight') next = (index + 1) % items.length;
      else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
      else return;
      e.preventDefault();
      onChange(items[next].id);
      const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
      radios?.[next]?.focus();
    },
    [items, onChange],
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label ?? 'Style selection'}
      className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide"
    >
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={item.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={[
              'shrink-0 snap-start flex items-center justify-center',
              'size-[115px] rounded-[20px] transition-all duration-200 cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              selected
                ? 'border-3 border-white shadow-lg'
                : 'border border-transparent bg-[#34383c] hover:bg-[#3d4246]',
            ].join(' ')}
            style={item.gradient ? { backgroundImage: item.gradient } : undefined}
          >
            {item.thumbnail && (
              <span className="text-3xl" aria-hidden="true">{item.thumbnail}</span>
            )}
            {!item.thumbnail && !item.gradient && (
              <span className="text-xs text-gray-400">{item.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
