import { useState, useCallback, useMemo } from 'react';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';
import { countByGameType } from '@/ui/experts/expert-utils.ts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GameTypeOption {
  readonly id: string;
  readonly name: string;
  readonly emoji?: string;
  readonly category?: string;
  readonly supportedToday?: boolean;
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
  readonly expertCount: number;
  readonly onHover: (id: string | null) => void;
  readonly onConfirm: (id: string) => void;
}

function GameTypeCard({ option, isHovered, expertCount, onHover, onConfirm }: CardProps) {
  const baseClasses =
    'flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-200 border cursor-pointer';
  const stateClasses = isHovered
    ? 'bg-blue-500/15 border-blue-400 shadow-lg shadow-blue-500/10'
    : 'bg-white/5 border-white/10 hover:bg-white/8';

  return (
    <div
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
      {option.supportedToday === false && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600/50 text-gray-400">
          Coming Soon
        </span>
      )}
      {expertCount > 0 && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300"
          data-testid="expert-badge"
        >
          {expertCount} 款专家模板
        </span>
      )}
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
/*  Category tabs                                                      */
/* ------------------------------------------------------------------ */

interface CategoryTabsProps {
  readonly categories: readonly string[];
  readonly active: string | null;
  readonly onSelect: (cat: string | null) => void;
}

function CategoryTabs({ categories, active, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 px-3 scrollbar-hide">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
          active === null
            ? 'bg-blue-600 text-white'
            : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(cat)}
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
            active === cat
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GameTypeSelector                                                   */
/* ------------------------------------------------------------------ */

export function GameTypeSelector({ options, onSelect }: GameTypeSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const COLLAPSED_COUNT = 6;

  const expertCounts = useMemo(() => countByGameType(EXPERT_PRESETS), []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const opt of options) {
      if (opt.category) cats.add(opt.category);
    }
    return [...cats];
  }, [options]);

  const filtered = useMemo(() => {
    let result = [...options];
    if (activeCategory) {
      result = result.filter((o) => o.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.category?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [options, activeCategory, searchQuery]);

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
    <div className="flex flex-col gap-2 py-2">
      {/* Search */}
      <div className="px-3">
        <input
          type="text"
          placeholder="搜索游戏类型..."
          aria-label="搜索游戏类型"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <CategoryTabs
          categories={categories}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
        {(isExpanded || searchQuery.trim() || activeCategory
          ? filtered
          : filtered.slice(0, COLLAPSED_COUNT)
        ).map((option) => (
          <GameTypeCard
            key={option.id}
            option={option}
            isHovered={hoveredId === option.id}
            expertCount={expertCounts.get(option.id) ?? 0}
            onHover={handleHover}
            onConfirm={handleConfirm}
          />
        ))}
      </div>

      {/* Show More / Show Less */}
      {!searchQuery.trim() && !activeCategory && filtered.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="mx-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {isExpanded ? '收起' : `显示更多 (${filtered.length - COLLAPSED_COUNT})`}
        </button>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-xs text-gray-500 py-4">
          未找到匹配的游戏类型
        </p>
      )}
    </div>
  );
}
