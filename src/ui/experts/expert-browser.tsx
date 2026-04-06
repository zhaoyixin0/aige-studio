import { useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';
import { GAME_TYPE_META } from '@/agent/game-presets.ts';
import { parseConfidence, groupByGameType } from './expert-utils.ts';
import { ExpertPresetCard } from './expert-preset-card.tsx';

export interface ExpertBrowserProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onUsePreset: (presetId: string) => void;
  readonly initialGameType?: string;
}

export function ExpertBrowser({
  isOpen,
  onClose,
  onUsePreset,
  initialGameType,
}: ExpertBrowserProps) {
  const [search, setSearch] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState<string>(initialGameType ?? '');
  const [minConfidence, setMinConfidence] = useState(0.6);

  // Available game types that have expert presets
  const availableTypes = useMemo(() => {
    const grouped = groupByGameType(EXPERT_PRESETS);
    return [...grouped.keys()].sort();
  }, []);

  // Filtered and sorted presets
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXPERT_PRESETS
      .filter((p) => {
        // Game type filter
        if (gameTypeFilter && p.gameType !== gameTypeFilter) return false;
        // Confidence filter
        const conf = parseConfidence(p.tags) ?? 0;
        if (conf < minConfidence) return false;
        // Search
        if (q) {
          const haystack = [p.title, p.description ?? '', p.id, p.gameType ?? '']
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ca = parseConfidence(a.tags) ?? 0;
        const cb = parseConfidence(b.tags) ?? 0;
        if (cb !== ca) return cb - ca;
        return a.title.localeCompare(b.title);
      });
  }, [search, gameTypeFilter, minConfidence]);

  const handleReset = useCallback(() => {
    setSearch('');
    setGameTypeFilter('');
    setMinConfidence(0.6);
  }, []);

  const handleUse = useCallback((presetId: string) => {
    onUsePreset(presetId);
    onClose();
  }, [onUsePreset, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="expert-browser">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[80vh] mx-4 flex flex-col
        bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-gray-100">
            专家模板库
            <span className="ml-2 text-sm font-normal text-gray-500">
              {filtered.length} / {EXPERT_PRESETS.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 px-5 py-3 border-b border-white/5">
          {/* Search */}
          <input
            type="text"
            placeholder="搜索模板..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
              text-sm text-gray-200 placeholder-gray-500
              focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            data-testid="expert-search"
          />

          {/* Game type dropdown */}
          <select
            value={gameTypeFilter}
            onChange={(e) => setGameTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
              text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            data-testid="expert-gametype-filter"
          >
            <option value="">全部类型</option>
            {availableTypes.map((gt) => {
              const meta = GAME_TYPE_META[gt as keyof typeof GAME_TYPE_META];
              return (
                <option key={gt} value={gt}>
                  {meta ? `${meta.emoji ?? ''} ${meta.displayName}` : gt}
                </option>
              );
            })}
          </select>

          {/* Confidence filter */}
          <select
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
              text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            data-testid="expert-confidence-filter"
          >
            <option value={0}>全部置信度</option>
            <option value={0.6}>置信度 &ge; 60%</option>
            <option value={0.75}>置信度 &ge; 75%</option>
            <option value={0.85}>置信度 &ge; 85%</option>
          </select>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((preset) => (
                <ExpertPresetCard
                  key={preset.id}
                  preset={preset}
                  onUse={handleUse}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <p className="text-sm">未找到符合条件的专家模板</p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-3 px-4 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10
                  border border-white/10 text-gray-400 hover:text-white transition-colors"
                data-testid="expert-reset-filters"
              >
                重置筛选
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
