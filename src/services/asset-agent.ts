// src/services/asset-agent.ts
// AssetAgent — scans a GameConfig for asset keys, generates images via Gemini,
// removes backgrounds for sprites, and persists results to the AssetLibrary.

import type { AssetEntry, GameConfig } from '@/engine/core';
import { PromptBuilder } from './prompt-builder';
import { AssetLibrary } from './asset-library';
import { BgRemover } from './bg-remover';
import { getGeminiImageService } from './gemini-image';
import type { GeminiImageService } from './gemini-image';
import type { PromptContext } from './prompt-builder';

export interface AssetFulfillProgress {
  current: number;
  total: number;
  key: string;
  status: 'generating' | 'removing-bg' | 'done' | 'skipped' | 'error';
}

/**
 * Extract all asset keys referenced by the game config.
 *
 * Strategy: walk every module's params. Any module that has an `items`
 * array (Spawner, Randomizer, etc.) contributes asset keys from
 * `item.asset`. We also include the top-level `config.assets` keys so
 * placeholder entries get fulfilled.
 */
export function extractAssetKeys(config: GameConfig): string[] {
  const keys = new Set<string>();

  // 1. Keys already declared in config.assets (may be placeholders)
  for (const key of Object.keys(config.assets)) {
    keys.add(key);
  }

  // 2. Walk modules — any module with an items array
  for (const mod of config.modules) {
    const items = mod.params?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'string') {
          keys.add(item);
        } else if (item && typeof item.asset === 'string') {
          keys.add(item.asset);
        }
      }
    }
  }

  return [...keys];
}

export class AssetAgent {
  private library = new AssetLibrary();
  private bgRemover = new BgRemover();
  private abortController: AbortController | null = null;

  /**
   * For every asset key in the config that has no real image data,
   * generate one via Gemini, optionally remove the background,
   * save to the library, and return a map of assetId → AssetEntry
   * that the caller can batch-apply to the game store.
   */
  async fulfillAssets(
    config: GameConfig,
    onProgress?: (p: AssetFulfillProgress) => void,
  ): Promise<Record<string, AssetEntry>> {
    // Cancel any previous run
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    await this.library.ready();

    const keys = extractAssetKeys(config);
    const result: Record<string, AssetEntry> = {};

    // Determine which keys actually need generation
    const keysToProcess = keys.filter((key) => {
      const existing = config.assets[key];
      // Already has real image data — skip
      if (existing?.src.startsWith('data:')) return false;
      // Already has an ai-generated or user asset — skip
      if (existing?.src.startsWith('ai-generated://')) return false;
      if (existing?.src.startsWith('user://')) return false;
      return true;
    });

    const total = keysToProcess.length;
    if (total === 0) return result;

    // Try to obtain Gemini service — may throw if no API key
    let gemini: GeminiImageService | null = null;
    try {
      gemini = getGeminiImageService();
    } catch {
      // No API key configured — skip generation entirely
    }
    if (!gemini) return result;

    const theme = config.meta?.theme ?? '';
    const style: PromptContext['style'] = 'cartoon';

    for (let i = 0; i < keysToProcess.length; i++) {
      if (signal.aborted) return result;

      const key = keysToProcess[i];

      onProgress?.({ current: i + 1, total, key, status: 'generating' });

      // Check library for a cached version first
      const cached = this.library.findByKeyAndTheme(key, theme || undefined);
      if (cached) {
        result[key] = { type: cached.type, src: cached.src };
        onProgress?.({ current: i + 1, total, key, status: 'done' });
        continue;
      }

      try {
        const role = PromptBuilder.inferRole(key);
        const prompt = PromptBuilder.build(key, {
          gameType: config.meta?.name ?? 'game',
          theme: theme || 'default',
          role,
          style,
        });

        // Use generateImageRaw — PromptBuilder already includes style
        let dataUrl = await gemini.generateImageRaw(prompt);

        if (signal.aborted) return result;

        // Remove background for non-background sprites
        const assetType: AssetEntry['type'] = role === 'background' ? 'background' : 'sprite';
        if (assetType !== 'background') {
          onProgress?.({ current: i + 1, total, key, status: 'removing-bg' });
          try {
            dataUrl = await this.bgRemover.remove(dataUrl);
          } catch (err) {
            console.warn(`BgRemoval failed for ${key}, using original:`, err);
          }
        }

        if (signal.aborted) return result;

        // Save to library
        const name = this.library.generateName(key, theme || undefined);
        await this.library.save({
          name,
          tags: [key, theme || 'default'].filter(Boolean),
          type: assetType,
          src: dataUrl,
          gameType: config.meta?.name,
          theme: theme || undefined,
        });

        result[key] = { type: assetType, src: dataUrl };
        onProgress?.({ current: i + 1, total, key, status: 'done' });
      } catch (err) {
        console.warn(`Asset generation failed for ${key}:`, err);
        onProgress?.({ current: i + 1, total, key, status: 'error' });
      }
    }

    return result;
  }

  /** Cancel any in-progress fulfillment run. */
  cancel(): void {
    this.abortController?.abort();
  }
}
