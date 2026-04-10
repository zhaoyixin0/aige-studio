// src/engine/systems/recipe-runner/hero-skeleton-builder.ts
//
// Thin adapter that converts a hero-skeleton preset JSON into a GameConfig
// by delegating to the pure build pipeline in conversation-agent.
//
// Why this file exists: the facade previously duplicated module setup logic
// in RecipeExecutor. The hero-skeleton format is intentionally thin — it
// holds only gameType + signature + emphasis — so we need to route it
// through the same buildGameConfig path used by the create_game tool. This
// file is the single place that imports the agent layer from the engine
// layer so the coupling is explicit and localized.

import type { GameConfig } from '../../core/types';
import { loadHeroSkeleton } from '@/agent/hero-preset-loader';
import {
  buildGameConfigPure,
  getSharedContracts,
} from '@/agent/conversation-agent';

export interface HeroSkeletonBuildResult {
  readonly config: GameConfig;
  readonly presetId: string;
}

/**
 * Convert a hero-skeleton preset JSON into a fully-wired GameConfig.
 * Immutable — does not mutate input.
 */
export function buildHeroSkeletonConfig(presetJson: unknown): HeroSkeletonBuildResult {
  const loaded = loadHeroSkeleton(presetJson);
  const { config } = buildGameConfigPure(loaded.createParams, getSharedContracts());

  // Merge meta overrides (title → name, description, preset identity,
  // concept, signature items) from the skeleton. The preset-enrichment
  // hook uses heroPresetId + concept + signature* to drive the async
  // skill pass, so these must flow all the way through to the store.
  const meta = loaded.metaOverrides ?? {};
  const merged: GameConfig = {
    ...config,
    meta: {
      ...config.meta,
      ...(typeof meta.name === 'string' ? { name: meta.name } : {}),
      ...(typeof meta.description === 'string'
        ? { description: meta.description }
        : {}),
      // Preserve original hero-skeleton gameType so inferGameType can recover
      // niche types like slingshot / whack-a-mole that have no 1-to-1 module.
      gameType: loaded.createParams.game_type,
      ...(typeof meta.heroPresetId === 'string'
        ? { heroPresetId: meta.heroPresetId }
        : { heroPresetId: loaded.heroPresetId }),
      ...(typeof meta.concept === 'string' ? { concept: meta.concept } : {}),
      ...(Array.isArray(meta.signatureGoods)
        ? { signatureGoods: meta.signatureGoods as readonly string[] }
        : {}),
      ...(Array.isArray(meta.signatureBads)
        ? { signatureBads: meta.signatureBads as readonly string[] }
        : {}),
    },
  };

  return { config: merged, presetId: loaded.heroPresetId };
}
