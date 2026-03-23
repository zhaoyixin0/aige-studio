import { useState, useMemo, useEffect } from 'react';
import { Search, Image, Volume2, Palette, Grid3X3 } from 'lucide-react';
import { PREBUILT_ASSETS, type PrebuiltAsset } from '@/assets/prebuilt.ts';
import { useGameStore } from '@/store/game-store.ts';
import type { AssetEntry } from '@/engine/core';
import { AssetLibrary, type LibraryAsset } from '@/services/asset-library.ts';

type FilterType = 'all' | 'sprite' | 'sound' | 'background';

interface DisplayAsset {
  id: string;
  name: string;
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;
  thumbnail?: string;
  source: 'prebuilt' | 'user' | 'ai-generated' | 'library';
}

function storeAssetsToDisplayAssets(
  assets: Record<string, AssetEntry>,
): DisplayAsset[] {
  return Object.entries(assets)
    .filter(([, entry]) => entry.src.startsWith('user://') || entry.src.startsWith('ai-generated://'))
    .map(([id, entry]) => ({
      id,
      name: id,
      type: entry.type,
      src: entry.src,
      thumbnail: entry.src.startsWith('user://') || entry.src.startsWith('ai-generated://')
        ? entry.src
        : undefined,
      source: (entry.src.startsWith('user://') ? 'user' : 'ai-generated') as 'user' | 'ai-generated',
    }));
}

function prebuiltToDisplay(asset: PrebuiltAsset): DisplayAsset {
  return {
    ...asset,
    source: 'prebuilt',
  };
}

function libraryToDisplay(asset: LibraryAsset): DisplayAsset {
  return {
    id: asset.id,
    name: `\uD83D\uDCDA ${asset.name}`,
    type: asset.type,
    src: asset.src,
    thumbnail: asset.src.startsWith('data:') ? asset.src : undefined,
    source: 'library',
  };
}

/** Singleton library instance shared across renders. */
const sharedLibrary = new AssetLibrary();

const FILTER_TABS: { value: FilterType; label: string; icon: typeof Grid3X3 }[] = [
  { value: 'all', label: 'All', icon: Grid3X3 },
  { value: 'sprite', label: 'Sprites', icon: Image },
  { value: 'sound', label: 'Sounds', icon: Volume2 },
  { value: 'background', label: 'Backgrounds', icon: Palette },
];

const EMPTY_ASSETS: Record<string, AssetEntry> = {};

/** Stable selector — extracted to module scope so the function reference never changes. */
const selectAssets = (s: { config: { assets: Record<string, AssetEntry> } | null }) =>
  s.config?.assets ?? EMPTY_ASSETS;

interface AssetBrowserProps {
  onSelect?: (assetId: string, src: string) => void;
}

export function AssetBrowser({ onSelect }: AssetBrowserProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const storeAssets = useGameStore(selectAssets);

  // Load library assets on mount
  useEffect(() => {
    let cancelled = false;
    sharedLibrary.ready().then(() => {
      if (!cancelled) {
        setLibraryAssets(sharedLibrary.getAll());
      }
    });
    return () => { cancelled = true; };
  }, [storeAssets]); // re-load when store assets change (new assets may have been saved)

  const allAssets = useMemo(() => {
    const prebuilt = PREBUILT_ASSETS.map(prebuiltToDisplay);
    const userAssets = storeAssetsToDisplayAssets(storeAssets);
    const libAssets = libraryAssets.map(libraryToDisplay);
    // Deduplicate: library assets that share an id with a store asset are skipped
    const storeIds = new Set(Object.keys(storeAssets));
    const dedupedLib = libAssets.filter((a) => !storeIds.has(a.id));
    return [...prebuilt, ...userAssets, ...dedupedLib];
  }, [storeAssets, libraryAssets]);

  const filtered = useMemo(() => {
    let result = allAssets;

    if (filter !== 'all') {
      result = result.filter((a) => a.type === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allAssets, filter, search]);

  function handleSelect(asset: DisplayAsset) {
    setSelectedId(asset.id);
    onSelect?.(asset.id, asset.src);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              filter === value
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-xs">
          No assets found
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {filtered.map((asset) => (
            <button
              key={`${asset.source}-${asset.id}`}
              onClick={() => handleSelect(asset)}
              className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${
                selectedId === asset.id
                  ? 'bg-blue-600/20 border border-blue-500/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              title={asset.name}
            >
              <div className="w-10 h-10 flex items-center justify-center rounded bg-white/5 text-lg">
                {asset.thumbnail ? (
                  asset.thumbnail.startsWith('data:') ? (
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <span>{asset.thumbnail}</span>
                  )
                ) : asset.type === 'sound' ? (
                  <Volume2 size={16} className="text-gray-400" />
                ) : (
                  <Image size={16} className="text-gray-400" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                {asset.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
