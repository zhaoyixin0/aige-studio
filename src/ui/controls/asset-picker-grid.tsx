import { useCallback, useRef } from 'react';

export interface AssetItem {
  readonly id: string;
  readonly thumbnail: string;
  readonly label?: string;
}

export interface AssetPickerGridProps {
  readonly assets: readonly AssetItem[];
  readonly value: string;
  readonly onChange: (assetId: string) => void;
  readonly label?: string;
}

export function AssetPickerGrid({ assets, value, onChange, label }: AssetPickerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const ids = assets.map((a) => a.id);
      const currentIndex = ids.indexOf(value);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, ids.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      if (nextIndex !== null && nextIndex !== currentIndex) {
        onChange(ids[nextIndex]);
        requestAnimationFrame(() => {
          const radios = containerRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
          radios?.[nextIndex]?.focus();
        });
      }
    },
    [assets, value, onChange],
  );

  return (
    <div ref={containerRef} role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2" onKeyDown={handleKeyDown}>
      {assets.map((asset) => {
        const isSelected = asset.id === value;
        const displayLabel = asset.label ?? asset.id;

        return (
          <button
            key={asset.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={displayLabel}
            tabIndex={isSelected ? 0 : -1}
            className={`
              flex flex-col items-center gap-1 rounded-lg p-2 transition-all
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${isSelected
                ? 'bg-blue-600/20 ring-2 ring-blue-500'
                : 'bg-white/5 hover:bg-white/10'
              }
            `}
            onClick={() => onChange(asset.id)}
          >
            <img
              src={asset.thumbnail}
              alt={displayLabel}
              loading="lazy"
              className="w-12 h-12 rounded object-cover"
            />
            <span className="text-[10px] text-gray-400 truncate max-w-full">
              {displayLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
