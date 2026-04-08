/**
 * Streaming asset fulfillment hook (Phase B).
 *
 * Shared entry point used by both landing-page and use-conversation-manager
 * to kick off background asset generation with per-sprite streaming updates.
 *
 * On each invocation of the returned `triggerStreamingFulfillment(config)`:
 *   1. Pre-seed a new assistant chat message containing:
 *      - a `progress-log` block with one `pending` entry per expected asset
 *      - an `asset-preview` block with one skeleton slot per expected asset
 *   2. Instantiate a fresh `AssetAgent` + `makeStreamingApplier()` tied to the
 *      new message id and the current engine ref.
 *   3. Start `assetAgent.fulfillAssets(config, { onProgress, onAsset })` which
 *      will stream each asset into the store + chat message + engine as they
 *      complete (see use-asset-stream-applier.ts).
 *   4. On completion, collapse the message: replace the main text with a
 *      success summary and drop the progress-log block (asset-preview stays
 *      as a permanent thumbnail grid).
 *   5. On foreign config change (race guard trips) or explicit error, emit a
 *      quiet fallback message — no throw.
 */
import { useCallback } from 'react';
import { AssetAgent, extractAssetKeys } from '@/services/asset-agent';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import { makeStreamingApplier } from '@/app/hooks/use-asset-stream-applier';
import type { GameConfig } from '@/engine/core';
import type {
  AssetPreviewItem,
  ChatBlock,
  ProgressEntry,
} from '@/agent/conversation-defs';

export interface StreamingAssetFulfillmentHook {
  /**
   * Start streaming asset fulfillment for a new game config.
   * Returns immediately — the actual generation runs in the background.
   */
  triggerStreamingFulfillment: (config: GameConfig) => void;
}

export function useStreamingAssetFulfillment(): StreamingAssetFulfillmentHook {
  const { engineRef } = useEngineContext();

  const triggerStreamingFulfillment = useCallback(
    (newConfig: GameConfig): void => {
      // Determine which keys actually need generation (same filter as
      // asset-agent so progress-log matches reality).
      const allKeys = extractAssetKeys(newConfig);
      const expectedKeys = allKeys.filter((k) => {
        const existing = newConfig.assets[k];
        if (!existing) return true;
        if (existing.src.startsWith('data:')) return false;
        if (existing.src.startsWith('ai-generated://')) return false;
        if (existing.src.startsWith('user://')) return false;
        return true;
      });

      // If nothing needs generating, skip the whole ceremony.
      if (expectedKeys.length === 0) return;

      // 1. Seed the progress message with pending entries + skeleton items.
      const progressMsgId = crypto.randomUUID();
      const initialEntries: ProgressEntry[] = expectedKeys.map((key) => ({
        key,
        status: 'pending',
        message: `等待中: ${key}`,
      }));
      const initialItems: AssetPreviewItem[] = expectedKeys.map((key) => ({
        key,
        label: key,
        src: '', // empty → skeleton in asset-preview-block
        source: 'ai',
      }));

      const progressMsg: ChatMessage = {
        id: progressMsgId,
        role: 'assistant',
        content: `\uD83C\uDFA8 正在生成 ${expectedKeys.length} 个游戏素材...`,
        timestamp: Date.now(),
        blocks: [
          { kind: 'progress-log', entries: initialEntries },
          { kind: 'asset-preview', items: initialItems, allowApplyAll: false },
        ],
      };
      useEditorStore.getState().addChatMessage(progressMsg);

      // 2. Build the streaming applier — must be AFTER addChatMessage so
      //    updateChatMessage(progressMsgId) can find the target message,
      //    AND so v0 captures the current configVersion (already bumped by
      //    the upstream setConfig call the caller just performed).
      const assetAgent = new AssetAgent();
      const applier = makeStreamingApplier({ engineRef, progressMsgId });

      // 3. Fire and forget.
      assetAgent
        .fulfillAssets(newConfig, {
          onProgress: applier.onProgress,
          onAsset: applier.onAsset,
        })
        .then(() => {
          // Foreign change detected mid-stream → stay quiet.
          if (applier.isStopped) return;

          const count = applier.appliedCount;

          // 4. Collapse: replace main text, drop progress-log, keep asset-preview.
          useEditorStore.getState().updateChatMessage(progressMsgId, (msg) => ({
            ...msg,
            content:
              count > 0
                ? `\u2705 已生成 ${count} 个游戏素材！`
                : `\u2139\uFE0F 无需额外素材`,
            blocks: msg.blocks?.filter(
              (b: ChatBlock) => b.kind !== 'progress-log',
            ),
          }));
        })
        .catch((err) => {
          // Genuine error (not race guard) — silent if applier already stopped.
          if (applier.isStopped) return;
          const errMsg = err instanceof Error ? err.message : String(err);
          useEditorStore.getState().addChatMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `\u274C 素材生成失败: ${errMsg}`,
            timestamp: Date.now(),
          });
        });
    },
    [engineRef],
  );

  return { triggerStreamingFulfillment };
}
