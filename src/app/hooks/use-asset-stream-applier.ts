/**
 * Streaming asset applier factory (Phase A, Step A3).
 *
 * `makeStreamingApplier` builds a pair of callbacks (`onProgress`, `onAsset`)
 * that can be passed to `AssetAgent.fulfillAssets()`. Each incoming asset is
 * streamed into:
 *   1. `useGameStore.batchUpdateAssets({ [key]: entry })` — incremental store write
 *   2. `engine.eventBus.emit('assets:updated', { updates: [...] })` — renderer hot-swap
 *   3. `useEditorStore.updateChatMessage(id, ...)` — live UI patch (thumbnail + log)
 *
 * Race guard: a monotonic sequence check `configVersion === v0 + applied`
 * stops the applier silently if another actor (e.g. user switched games)
 * bumps `configVersion` out of band.
 */
import type { RefObject } from 'react';
import type { AssetFulfillProgress } from '@/services/asset-agent';
import type { AssetEntry, Engine } from '@/engine/core';
import type {
  AssetPreviewItem,
  ChatBlock,
  ProgressEntry,
} from '@/agent/conversation-defs';
import { useGameStore } from '@/store/game-store';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';

export interface StreamApplierDeps {
  engineRef: RefObject<Engine | null>;
  progressMsgId: string;
}

export interface StreamApplier {
  onProgress: (p: AssetFulfillProgress) => void;
  onAsset: (
    key: string,
    entry: AssetEntry,
    ctx: { index: number; total: number },
  ) => Promise<void>;
  readonly appliedCount: number;
  readonly isStopped: boolean;
}

function humanLabel(p: AssetFulfillProgress): string {
  const base = p.key;
  switch (p.status) {
    case 'generating':
      return `生成中: ${base} (${p.current}/${p.total})`;
    case 'removing-bg':
      return `去背景: ${base} (${p.current}/${p.total})`;
    case 'done':
      return `完成: ${base}`;
    case 'error':
      return `失败: ${base}`;
    case 'skipped':
      return `跳过: ${base}`;
    default:
      return base;
  }
}

/**
 * Replace one block of a given kind in a ChatMessage immutably.
 * Returns the same message unchanged if it has no blocks.
 */
function mutateBlock<K extends ChatBlock['kind']>(
  msg: ChatMessage,
  kind: K,
  mutator: (block: Extract<ChatBlock, { kind: K }>) => Extract<ChatBlock, { kind: K }>,
): ChatMessage {
  if (!msg.blocks) return msg;
  return {
    ...msg,
    blocks: msg.blocks.map((b: ChatBlock) =>
      b.kind === kind ? mutator(b as Extract<ChatBlock, { kind: K }>) : b,
    ),
  };
}

export function makeStreamingApplier(deps: StreamApplierDeps): StreamApplier {
  const v0 = useGameStore.getState().configVersion;
  let applied = 0;
  let stopped = false;

  const updateMessage = useEditorStore.getState().updateChatMessage;

  function patchProgressLog(p: AssetFulfillProgress): void {
    updateMessage(deps.progressMsgId, (msg) =>
      mutateBlock(msg, 'progress-log', (block) => ({
        ...block,
        entries: block.entries.map<ProgressEntry>((e) =>
          e.key === p.key
            ? { ...e, status: p.status, message: humanLabel(p) }
            : e,
        ),
      })),
    );
  }

  function patchAssetPreview(key: string, entry: AssetEntry): void {
    updateMessage(deps.progressMsgId, (msg) =>
      mutateBlock(msg, 'asset-preview', (block) => ({
        ...block,
        items: block.items.map<AssetPreviewItem>((item) =>
          item.key === key ? { ...item, src: entry.src } : item,
        ),
      })),
    );
  }

  return {
    onProgress(p: AssetFulfillProgress): void {
      if (stopped) return;
      patchProgressLog(p);
    },

    async onAsset(
      key: string,
      entry: AssetEntry,
      _ctx: { index: number; total: number },
    ): Promise<void> {
      if (stopped) return;

      const current = useGameStore.getState().configVersion;
      if (current !== v0 + applied) {
        // Foreign change detected — bail quietly.
        stopped = true;
        return;
      }

      // 1. Incremental store write (bumps configVersion by 1)
      useGameStore.getState().batchUpdateAssets({ [key]: entry });
      applied += 1;

      // 2. Engine hot-swap event (no-op if engine not mounted yet)
      const engine = deps.engineRef.current;
      engine?.eventBus.emit('assets:updated', {
        updates: [{ key, src: entry.src, type: entry.type }],
      });

      // 3. Live chat UI patch: thumbnail src
      patchAssetPreview(key, entry);
    },

    get appliedCount(): number {
      return applied;
    },

    get isStopped(): boolean {
      return stopped;
    },
  };
}
