import { type ChatBlock } from '@/agent/conversation-defs';
import type { AssetEntry } from '@/engine/core';
import { useGameStore } from '@/store/game-store';
import { Loader2 } from 'lucide-react';

interface AssetPreviewBlockProps {
  block: Extract<ChatBlock, { kind: 'asset-preview' }>;
}

export function AssetPreviewBlock({ block }: AssetPreviewBlockProps) {
  const updateAsset = useGameStore((s) => s.updateAsset);
  const batchUpdateAssets = useGameStore((s) => s.batchUpdateAssets);

  const handleApply = (key: string, src: string) => {
    updateAsset(key, src);
  };

  const handleApplyAll = () => {
    const assets: Record<string, AssetEntry> = {};
    for (const item of block.items) {
      assets[item.key] = { src: item.src, type: item.key === 'background' ? 'background' : 'sprite' };
    }
    batchUpdateAssets(assets);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">素材预览</div>
        {block.allowApplyAll && block.items.length > 1 && (
          <button 
            onClick={handleApplyAll}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            全部应用
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
        {block.items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1.5 group">
            <div className="aspect-square rounded-lg border border-white/10 bg-black/20 overflow-hidden relative">
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.label}
                  className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-white/5 animate-pulse flex flex-col items-center justify-center gap-1 rounded-lg">
                  <Loader2 size={20} className="text-white/20 animate-spin" />
                  <span className="text-[9px] text-white/30">生成中</span>
                </div>
              )}
              {item.src && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleApply(item.key, item.src)}
                    className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded"
                  >
                    应用
                  </button>
                </div>
              )}
            </div>
            <div className="text-[10px] text-white/40 truncate text-center" title={item.label}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
