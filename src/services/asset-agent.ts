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

  // 2. Walk modules for asset references
  for (const mod of config.modules) {
    // Spawner/Randomizer items: { asset: string }
    const items = mod.params?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'string') {
          keys.add(item);
        } else if (item && typeof item.asset === 'string') {
          keys.add(item.asset);
        } else if (item && typeof item.type === 'string') {
          keys.add(item.type);
        }
      }
    }

    // Hazard hazards array
    const hazards = mod.params?.hazards;
    if (mod.type === 'Hazard' && Array.isArray(hazards)) {
      keys.add('hazard');
    }
  }

  // 3. Include player character if game has a visual player
  const needsPlayer = config.modules.some(m =>
    m.type === 'Spawner' || m.type === 'PlayerMovement'
  );
  if (needsPlayer) {
    keys.add('player');
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

    console.log('[AssetAgent] Extracted asset keys:', keys);

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
    console.log('[AssetAgent] All extracted keys:', keys);
    console.log('[AssetAgent] Keys to process (after filter):', keysToProcess, `(${total} total)`);
    console.log('[AssetAgent] Config assets:', Object.keys(config.assets), config.assets);
    if (total === 0) return result;

    // Try to obtain Gemini service — may throw if no API key
    let gemini: GeminiImageService | null = null;
    try {
      gemini = getGeminiImageService();
      console.log('[AssetAgent] Gemini service obtained successfully');
    } catch (err) {
      console.warn('[AssetAgent] No Gemini API key:', err);
    }
    if (!gemini) return result;

    const theme = config.meta?.theme ?? '';
    const style = (config.meta?.artStyle as PromptContext['style']) || 'cartoon';
    const assetDescriptions = config.meta?.assetDescriptions;

    for (let i = 0; i < keysToProcess.length; i++) {
      if (signal.aborted) return result;

      const key = keysToProcess[i];

      onProgress?.({ current: i + 1, total, key, status: 'generating' });

      // Check library for a cached version first (must have valid data URL)
      const cached = this.library.findByKeyAndTheme(key, theme || undefined);
      if (cached && cached.src && cached.src.startsWith('data:')) {
        let src = cached.src;
        if (cached.type !== 'background') {
          try { src = await this.resizeImage(src, 128, 128); } catch { /* keep original */ }
        }
        result[key] = { type: cached.type, src };
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
          assetDescriptions,
        });

        // Pass role-specific image config (aspectRatio, imageSize) to Nano Banana Pro
        const imageConfig = PromptBuilder.getImageConfig(role);
        let dataUrl = await gemini.generateImageRaw(prompt, imageConfig);

        if (signal.aborted) return result;

        // Remove background for non-background sprites
        // Use fast chroma-key removal (prompts request #00FF00 green background)
        // Falls back to slow AI removal if green pixels < 5%
        const assetType: AssetEntry['type'] = role === 'background' ? 'background' : 'sprite';
        if (assetType !== 'background') {
          onProgress?.({ current: i + 1, total, key, status: 'removing-bg' });
          try {
            dataUrl = await this.bgRemover.chromaKeyRemove(dataUrl);
          } catch (err) {
            console.warn(`[AssetAgent] Chroma key failed for ${key}, trying AI removal:`, err);
            try {
              dataUrl = await this.bgRemover.remove(dataUrl);
            } catch (err2) {
              console.warn(`[AssetAgent] AI removal also failed for ${key}, using original:`, err2);
            }
          }
        }

        if (signal.aborted) return result;

        // Resize from 1024x1024 generation to game target sizes
        // Sprites: 128x128, Backgrounds: 540x960 (already native 9:16 from API)
        const targetSize = assetType === 'background' ? { w: 540, h: 960 } : { w: 128, h: 128 };
        dataUrl = await this.resizeImage(dataUrl, targetSize.w, targetSize.h);

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
        console.error(`[AssetAgent] ❌ Generation FAILED for "${key}" (role: ${PromptBuilder.inferRole(key)}):`, err);
        onProgress?.({ current: i + 1, total, key, status: 'error' });
      }
    }

    return result;
  }

  /** Resize an image data URL to target dimensions */
  private resizeImage(dataUrl: string, maxW: number, maxH: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Maintain aspect ratio, fit within maxW x maxH
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for resize'));
      img.src = dataUrl;
    });
  }

  /** Cancel any in-progress fulfillment run. */
  cancel(): void {
    this.abortController?.abort();
  }
}
