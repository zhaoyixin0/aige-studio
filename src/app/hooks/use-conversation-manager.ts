import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ChatMessage, Chip } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import type { ConversationResult } from '@/agent/conversation-agent';
import { getConversationAgent } from '@/agent/singleton';
import { AssetAgent } from '@/services/asset-agent';
import type { GameConfig, AssetEntry } from '@/engine/core';

/* ------------------------------------------------------------------ */
/*  Stable Zustand selectors                                           */
/* ------------------------------------------------------------------ */

const selectAddChatMessage = (s: { addChatMessage: (msg: ChatMessage) => void }) =>
  s.addChatMessage;
const selectSetChatLoading = (s: { setChatLoading: (v: boolean) => void }) =>
  s.setChatLoading;
const selectSetSuggestionChips = (s: { setSuggestionChips: (chips: Chip[]) => void }) =>
  s.setSuggestionChips;
const selectConfig = (s: { config: GameConfig | null }) => s.config;
const selectSetConfig = (s: { setConfig: (c: GameConfig) => void }) => s.setConfig;
const selectBatchUpdateAssets = (s: { batchUpdateAssets: (a: Record<string, AssetEntry>) => void }) =>
  s.batchUpdateAssets;

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface ConversationManagerResult {
  submitMessage: (text: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useConversationManager(): ConversationManagerResult {
  const { engineRef } = useEngineContext();

  const addChatMessage = useEditorStore(selectAddChatMessage);
  const setChatLoading = useEditorStore(selectSetChatLoading);
  const setSuggestionChips = useEditorStore(selectSetSuggestionChips);

  const config = useGameStore(selectConfig);
  const setConfig = useGameStore(selectSetConfig);
  const batchUpdateAssets = useGameStore(selectBatchUpdateAssets);

  /* ---------------------------------------------------------------- */
  /*  Asset fulfillment                                                */
  /* ---------------------------------------------------------------- */

  const triggerAssetFulfillment = useCallback(
    (newConfig: GameConfig) => {
      const assetAgent = new AssetAgent();

      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '\uD83C\uDFA8 正在自动生成游戏素材...',
        timestamp: Date.now(),
      });

      assetAgent
        .fulfillAssets(newConfig, (progress) => {
          // Asset progress logging intentionally omitted from production hook
          void progress;
        })
        .then((assets) => {
          const count = Object.keys(assets).length;
          if (count > 0) {
            batchUpdateAssets(assets);
            // Push new assets into the running engine immutably
            const engine = engineRef.current;
            if (engine) {
              const prev = engine.getConfig();
              engine.loadConfig({ ...prev, assets: { ...prev.assets, ...assets } });
            }
            addChatMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `\u2705 已自动生成 ${count} 个游戏素材！`,
              timestamp: Date.now(),
            });
          }
        })
        .catch((err) => {
          addChatMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `\u274C 素材生成失败: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
          });
        });
    },
    [addChatMessage, batchUpdateAssets, engineRef],
  );

  /* ---------------------------------------------------------------- */
  /*  Submit message to ConversationAgent                              */
  /* ---------------------------------------------------------------- */

  const submitMessage = useCallback(
    async (text: string): Promise<void> => {
      // Add user message
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      setChatLoading(true);

      try {
        const agent = getConversationAgent();
        const result: ConversationResult = await agent.process(text, config ?? undefined);

        // Add assistant reply
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.reply,
          timestamp: Date.now(),
        });

        // Apply new config if provided
        if (result.config) {
          setConfig(result.config);
          triggerAssetFulfillment(result.config);
        }

        // Update suggestion chips if provided
        if (result.chips) {
          setSuggestionChips(result.chips);
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `\u274C 出错了: ${errorText}`,
          timestamp: Date.now(),
        });
      } finally {
        setChatLoading(false);
      }
    },
    [addChatMessage, setChatLoading, config, setConfig, setSuggestionChips, triggerAssetFulfillment],
  );

  return { submitMessage };
}
