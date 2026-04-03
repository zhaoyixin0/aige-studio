import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ChatMessage, Chip } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import type { ConversationResult } from '@/agent/conversation-agent';
import { validateConfig, applyFixes } from '@/engine/core/config-validator';
import { ContractRegistry } from '@/engine/core/contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';
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

        // Build assistant message
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.reply,
          timestamp: Date.now(),
          ...(result.parameterCard ? { parameterCard: result.parameterCard } : {}),
          ...(result.config ? { l1Controls: true } : {}),
        };

        // A3: Detect vague intent response and inject gameTypeOptions
        const isVagueIntentResponse =
          result.reply.includes('请选择') && result.reply.includes('游戏类型');
        if (isVagueIntentResponse && !result.config) {
          assistantMsg.gameTypeOptions = [
            { id: 'catch', name: '接住游戏', emoji: '🎯' },
            { id: 'dodge', name: '躲避游戏', emoji: '🏃' },
            { id: 'tap', name: '点击游戏', emoji: '👆' },
            { id: 'shooting', name: '射击游戏', emoji: '🔫' },
            { id: 'runner', name: '跑酷游戏', emoji: '🏃‍♂️' },
            { id: 'platformer', name: '平台跳跃', emoji: '🦘' },
            { id: 'quiz', name: '答题游戏', emoji: '❓' },
            { id: 'rhythm', name: '节奏游戏', emoji: '🎵' },
            { id: 'random-wheel', name: '幸运转盘', emoji: '🎡' },
            { id: 'expression', name: '表情挑战', emoji: '😄' },
          ];
        }

        addChatMessage(assistantMsg);

        // Apply new config if provided (with validation + auto-fixes)
        let fixedConfig: GameConfig | undefined;
        if (result.config) {
          const contracts = ContractRegistry.fromRegistry(createModuleRegistry());
          const report = validateConfig(result.config, contracts);
          fixedConfig = report.fixes.length > 0 ? applyFixes(result.config, report.fixes) : result.config;
          setConfig(fixedConfig);
        }

        // Update suggestion chips if provided
        if (result.chips && result.chips.length > 0) {
          setSuggestionChips(result.chips);
        }

        // A9: Safety net — fallback V2 chips when config exists but no chips
        if (result.config && (!result.chips || result.chips.length === 0)) {
          setSuggestionChips([
            { id: 'board_mode', type: 'board_mode', label: 'GUI 面板', emoji: '🎛️' },
            { id: 'l1-difficulty', type: 'param', label: '调整难度', emoji: '🎚️', paramId: 'l1_001', category: 'abstract' },
            { id: 'l1-pacing', type: 'param', label: '调整节奏', emoji: '⏱️', paramId: 'l1_002', category: 'abstract' },
            { id: 'l1-emotion', type: 'param', label: '切换风格', emoji: '🎨', paramId: 'l1_003', category: 'abstract' },
          ]);
        }

        // Trigger asset fulfillment after all synchronous state updates
        if (fixedConfig) {
          triggerAssetFulfillment(fixedConfig);
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
