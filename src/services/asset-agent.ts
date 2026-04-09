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
 * Streaming callbacks for fulfillAssets. All callbacks are optional.
 *
 * - `onProgress` fires for every phase transition (generating/removing-bg/done/error).
 * - `onAsset` fires exactly once per successfully-delivered asset, AFTER the
 *   library.save() has completed and BEFORE the for loop continues to the
 *   next key. It is awaited so consumers can write to store / emit events
 *   synchronously relative to the generation loop.
 * - `onError` fires when a single key's generation throws (loop continues).
 */
export interface FulfillOptions {
  onProgress?: (p: AssetFulfillProgress) => void;
  onAsset?: (
    key: string,
    entry: AssetEntry,
    ctx: { index: number; total: number },
  ) => void | Promise<void>;
  onError?: (
    key: string,
    err: unknown,
    ctx: { index: number; total: number },
  ) => void;
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

    // EnemyAI: enemy sprite asset
    if (mod.type === 'EnemyAI') {
      const asset = mod.params?.asset;
      keys.add(typeof asset === 'string' ? asset : 'enemy_1');
    }

    // Projectile: bullet sprite asset
    if (mod.type === 'Projectile') {
      const asset = mod.params?.asset;
      keys.add(typeof asset === 'string' ? asset : 'bullet');
    }

    // EnemyDrop: loot table item assets
    if (mod.type === 'EnemyDrop') {
      const lootTable = mod.params?.lootTable;
      if (Array.isArray(lootTable)) {
        for (const entry of lootTable) {
          if (entry && typeof entry.asset === 'string') {
            keys.add(entry.asset);
          } else if (entry && typeof entry.item === 'string') {
            keys.add(entry.item);
          }
        }
      }
    }

    // DialogueSystem: speaker portrait assets
    if (mod.type === 'DialogueSystem') {
      const dialogues = mod.params?.dialogues;
      if (dialogues && typeof dialogues === 'object') {
        for (const tree of Object.values(dialogues as Record<string, unknown>)) {
          if (!tree || typeof tree !== 'object') continue;
          const nodes = (tree as Record<string, unknown>).nodes;
          if (!nodes || typeof nodes !== 'object') continue;
          for (const node of Object.values(nodes as Record<string, unknown>)) {
            if (node && typeof node === 'object' && typeof (node as Record<string, unknown>).portrait === 'string') {
              keys.add((node as Record<string, unknown>).portrait as string);
            }
          }
        }
      }
    }
  }

  // 3. Include player character if game has a visual player
  const needsPlayer = config.modules.some(m =>
    m.type === 'Spawner' || m.type === 'PlayerMovement'
  );
  if (needsPlayer) {
    keys.add('player');
  }

  // 4. Skip background for expression game type (camera feed is the background)
  const hasExpression = config.modules.some(m => m.type === 'ExpressionDetector');
  if (hasExpression) {
    keys.delete('background');
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
    opts?: FulfillOptions | ((p: AssetFulfillProgress) => void),
  ): Promise<Record<string, AssetEntry>> {
    // Normalize legacy function form → FulfillOptions
    const options: FulfillOptions =
      typeof opts === 'function' ? { onProgress: opts } : (opts ?? {});
    const onProgress = options.onProgress;
    const onAsset = options.onAsset;
    const onError = options.onError;
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
    } catch (err) {
      console.warn('[AssetAgent] No Gemini API key:', err);
    }
    if (!gemini) return result;

    const theme = config.meta?.theme ?? '';
    const style = (config.meta?.artStyle as PromptContext['style']) || 'cartoon';
    const assetDescriptions = config.meta?.assetDescriptions;

    // Build a combined cache key from theme + artStyle so style changes bypass cache
    const cacheTheme = theme ? `${theme}__${style}` : style;

    // Sprite target size: configurable via config.meta.spriteSize, default 256, max 512
    const spriteSize = Math.min(config.meta?.spriteSize ?? 256, 512);

    for (let i = 0; i < keysToProcess.length; i++) {
      if (signal.aborted) return result;

      const key = keysToProcess[i];

      onProgress?.({ current: i + 1, total, key, status: 'generating' });

      // Check library for a cached version first (must have valid data URL)
      // Use combined theme+style key so artStyle changes force regeneration
      const cached = this.library.findByKeyAndTheme(key, cacheTheme || undefined);
      if (cached && cached.src && cached.src.startsWith('data:')) {
        let src = cached.src;
        if (cached.type !== 'background') {
          try { src = await this.resizeImage(src, spriteSize, spriteSize); } catch { /* keep original */ }
        }
        result[key] = { type: cached.type, src };
        if (signal.aborted) return result;
        if (onAsset) {
          try {
            await onAsset(key, result[key], { index: i, total });
          } catch (err) {
            console.warn('[AssetAgent] onAsset callback threw:', err);
          }
        }
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
        // Thread the abort signal so cancellation aborts the in-flight fetch.
        const imageConfig = PromptBuilder.getImageConfig(role);
        let dataUrl = await gemini.generateImageRaw(prompt, imageConfig, signal);

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
        // Sprites: configurable (default 256, max 512), Backgrounds: 540x960
        const targetSize = assetType === 'background' ? { w: 540, h: 960 } : { w: spriteSize, h: spriteSize };
        dataUrl = await this.resizeImage(dataUrl, targetSize.w, targetSize.h);

        // Save to library with combined theme+style key for proper cache invalidation
        const name = this.library.generateName(key, theme || undefined);
        await this.library.save({
          name,
          tags: [key, theme || 'default'].filter(Boolean),
          type: assetType,
          src: dataUrl,
          gameType: config.meta?.name,
          theme: cacheTheme || undefined,
        });

        result[key] = { type: assetType, src: dataUrl };

        if (signal.aborted) return result;
        if (onAsset) {
          try {
            await onAsset(key, result[key], { index: i, total });
          } catch (err) {
            console.warn('[AssetAgent] onAsset callback threw:', err);
            // Do not rethrow — let the applier decide via its own race guard
          }
        }

        onProgress?.({ current: i + 1, total, key, status: 'done' });
      } catch (err) {
        console.warn(`[AssetAgent] ❌ Generation FAILED for "${key}" (role: ${PromptBuilder.inferRole(key)}):`, err);
        onProgress?.({ current: i + 1, total, key, status: 'error' });
        onError?.(key, err, { index: i, total });
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
        // Maintain aspect ratio, fit within maxW x maxH; the trailing `, 1` caps scale
        // at 1.0 so images smaller than the target are never upscaled.
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
