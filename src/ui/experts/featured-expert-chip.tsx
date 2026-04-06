import { useMemo } from 'react';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';
import { topByConfidence } from './expert-utils.ts';

interface FeaturedExpertChipProps {
  readonly onUse: (presetId: string) => void;
}

/**
 * Renders a single "featured expert" chip on the landing page.
 * Picks a random preset from the top-confidence pool on mount.
 */
export function FeaturedExpertChip({ onUse }: FeaturedExpertChipProps) {
  const featured = useMemo(() => {
    const candidates = topByConfidence(EXPERT_PRESETS, 12);
    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }, []);

  if (!featured) return null;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
        bg-purple-500/10 hover:bg-purple-500/20
        border border-purple-400/30 hover:border-purple-400/50
        text-purple-300 hover:text-purple-100
        transition-colors duration-200"
      onClick={() => onUse(featured.id)}
      data-testid="featured-expert-chip"
    >
      专家精选: {featured.title}
    </button>
  );
}
