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
 *
 * Cancellation (Task 7.2):
 *   - The hook tracks the active agent + applier + message id in refs and
 *     mirrors `isActive` into `useAssetFulfillmentStore` so unrelated UI
 *     (e.g. StudioChatPanel) can subscribe and trigger `cancel()`.
 *   - `cancel()` aborts the current AssetAgent's controller, replaces the
 *     progress message text with `"已取消，保留 N/M 张素材"`, drops the
 *     progress-log block, and keeps the asset-preview block intact so
 *     already-completed thumbnails remain visible.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { AssetAgent, extractAssetKeys } from '@/services/asset-agent';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import { makeStreamingApplier, type StreamApplier } from '@/app/hooks/use-asset-stream-applier';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';
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
  /** Abort the in-flight fulfillment, if any, and collapse its message. */
  cancel: () => void;
  /** True while a fulfillment run is in flight. */
  isActive: boolean;
}

interface ActiveRun {
  agent: AssetAgent;
  applier: StreamApplier;
  messageId: string;
  expectedTotal: number;
}

export function useStreamingAssetFulfillment(): StreamingAssetFulfillmentHook {
  const { engineRef } = useEngineContext();

  // Refs for the in-flight run — survive re-renders, no React state churn.
  const activeRunRef = useRef<ActiveRun | null>(null);

  // Subscribe to the singleton store so consumers re-render on isActive flips.
  const isActive = useSyncExternalStore(
    useAssetFulfillmentStore.subscribe,
    () => useAssetFulfillmentStore.getState().isActive,
    () => useAssetFulfillmentStore.getState().isActive,
  );

  /* ---------------------------------------------------------------- */
  /*  Cancel helper                                                    */
  /* ---------------------------------------------------------------- */

  const cancel = useCallback((): void => {
    const run = activeRunRef.current;
    if (!run) return;

    run.agent.cancel();

    const applied = run.applier.appliedCount;
    const total = run.expectedTotal;

    useEditorStore.getState().updateChatMessage(run.messageId, (msg) => ({
      ...msg,
      content: `\u26D4 \u5DF2\u53D6\u6D88\uFF0C\u4FDD\u7559 ${applied}/${total} \u5F20\u7D20\u6750`,
      blocks: msg.blocks?.filter((b: ChatBlock) => b.kind !== 'progress-log'),
    }));

    activeRunRef.current = null;
    useAssetFulfillmentStore.getState().setActive(false, null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Trigger                                                          */
  /* ---------------------------------------------------------------- */

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
        message: `\u7B49\u5F85\u4E2D: ${key}`,
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
        content: `\uD83C\uDFA8 \u6B63\u5728\u751F\u6210 ${expectedKeys.length} \u4E2A\u6E38\u620F\u7D20\u6750...`,
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

      const run: ActiveRun = {
        agent: assetAgent,
        applier,
        messageId: progressMsgId,
        expectedTotal: expectedKeys.length,
      };
      activeRunRef.current = run;
      useAssetFulfillmentStore.getState().setActive(true, { cancel });

      // 3. Fire and forget.
      assetAgent
        .fulfillAssets(newConfig, {
          onProgress: applier.onProgress,
          onAsset: applier.onAsset,
        })
        .then(() => {
          // If we were cancelled, the cancel() handler already cleaned up.
          if (activeRunRef.current !== run) return;

          // Foreign change detected mid-stream → stay quiet.
          if (applier.isStopped) {
            activeRunRef.current = null;
            useAssetFulfillmentStore.getState().setActive(false, null);
            return;
          }

          const count = applier.appliedCount;

          // 4. Collapse: replace main text, drop progress-log, keep asset-preview.
          useEditorStore.getState().updateChatMessage(progressMsgId, (msg) => ({
            ...msg,
            content:
              count > 0
                ? `\u2705 \u5DF2\u751F\u6210 ${count} \u4E2A\u6E38\u620F\u7D20\u6750\uFF01`
                : `\u2139\uFE0F \u65E0\u9700\u989D\u5916\u7D20\u6750`,
            blocks: msg.blocks?.filter(
              (b: ChatBlock) => b.kind !== 'progress-log',
            ),
          }));

          activeRunRef.current = null;
          useAssetFulfillmentStore.getState().setActive(false, null);
        })
        .catch((err) => {
          // If cancelled in the middle, the cancel() handler already cleaned up.
          if (activeRunRef.current !== run) return;
          // Genuine error (not race guard) — silent if applier already stopped.
          if (applier.isStopped) {
            activeRunRef.current = null;
            useAssetFulfillmentStore.getState().setActive(false, null);
            return;
          }
          const errMsg = err instanceof Error ? err.message : String(err);
          useEditorStore.getState().addChatMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `\u274C \u7D20\u6750\u751F\u6210\u5931\u8D25: ${errMsg}`,
            timestamp: Date.now(),
          });
          activeRunRef.current = null;
          useAssetFulfillmentStore.getState().setActive(false, null);
        });
    },
    [engineRef, cancel],
  );

  return { triggerStreamingFulfillment, cancel, isActive };
}
