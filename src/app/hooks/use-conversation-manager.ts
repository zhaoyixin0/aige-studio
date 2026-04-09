import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ChatMessage, Chip } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import type { ConversationResult } from '@/agent/conversation-agent';
import { validateConfig, applyFixes, type ValidationReport } from '@/engine/core/config-validator';
import { ContractRegistry } from '@/engine/core/contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';
import { getConversationAgent } from '@/agent/singleton';
import { buildGameTypeOptions } from '@/agent/game-type-options';
import { useStreamingAssetFulfillment } from '@/app/hooks/use-streaming-asset-fulfillment';
import { translateIssue } from '@/ui/preview/diagnostic-messages';
import type { GameConfig } from '@/engine/core';
import type { ChatBlock } from '@/agent/conversation-defs';

/**
 * Build a validation-summary assistant message from a ValidationReport.
 * Returns null when the report has no errors/warnings to report.
 */
function buildValidationSummaryMessage(report: ValidationReport): ChatMessage | null {
  const allIssues = [...report.errors, ...report.warnings];
  if (allIssues.length === 0) return null;

  const issues = allIssues.map((issue) => {
    const translated = translateIssue(issue);
    return {
      severity: translated.severity,
      title: translated.title,
      description: translated.description,
    };
  });

  const block: ChatBlock = {
    kind: 'validation-summary',
    summary: `${report.errors.length} 错误, ${report.warnings.length} 警告`,
    issues,
    fixable: report.fixes.length > 0,
  };

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `配置验证发现 ${report.errors.length} 个错误和 ${report.warnings.length} 个警告`,
    timestamp: Date.now(),
    blocks: [block],
  };
}

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
  const addChatMessage = useEditorStore(selectAddChatMessage);
  const setChatLoading = useEditorStore(selectSetChatLoading);
  const setSuggestionChips = useEditorStore(selectSetSuggestionChips);

  const config = useGameStore(selectConfig);
  const setConfig = useGameStore(selectSetConfig);

  /* ---------------------------------------------------------------- */
  /*  Streaming asset fulfillment (shared hook)                        */
  /* ---------------------------------------------------------------- */

  const { triggerStreamingFulfillment } = useStreamingAssetFulfillment();

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
          ...(result.expertInsight ? { expertInsight: result.expertInsight } : {}),
          ...(result.moduleTuning ? { moduleTuning: result.moduleTuning } : {}),
          ...(result.presetUsed ? { presetUsed: result.presetUsed } : {}),
          ...(result.blocks ? { blocks: result.blocks } : {}),
        };

        // A3: Detect vague intent response and inject gameTypeOptions
        const isVagueIntentResponse =
          result.reply.includes('请选择') && result.reply.includes('游戏类型');
        if (isVagueIntentResponse && !result.config) {
          assistantMsg.gameTypeOptions = buildGameTypeOptions();
        }

        addChatMessage(assistantMsg);

        // Apply new config if provided (with validation + auto-fixes)
        let fixedConfig: GameConfig | undefined;
        if (result.config) {
          const contracts = ContractRegistry.fromRegistry(createModuleRegistry());
          const report = validateConfig(result.config, contracts);
          fixedConfig = report.fixes.length > 0 ? applyFixes(result.config, report.fixes) : result.config;
          setConfig(fixedConfig);

          // Task 5.6: Inject validation-summary assistant message when issues exist
          const validationMsg = buildValidationSummaryMessage(report);
          if (validationMsg) {
            addChatMessage(validationMsg);
          }
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

        // Trigger streaming asset fulfillment after all synchronous state updates
        if (fixedConfig) {
          triggerStreamingFulfillment(fixedConfig);
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
    [addChatMessage, setChatLoading, config, setConfig, setSuggestionChips, triggerStreamingFulfillment],
  );

  return { submitMessage };
}
