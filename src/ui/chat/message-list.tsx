import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { ModuleTuningPayload } from '@/store/editor-store';
import { Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/store/editor-store';
import type { GameConfig } from '@/engine/core';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { ChatBlockRenderer } from './chat-block-renderer';
import { L1ExperienceCard } from './l1-experience-card';
import { BespokeParamCard } from './bespoke-cards';
import { GameTypeSelector } from './game-type-selector';
import { ExpertInsightBlock } from './expert-insight-block';
import { ModuleCombinationCard } from './module-combination-card';
import { PresetSuggestionBlock } from './preset-suggestion-block';
import { applyL1Preset } from '@/engine/core/composite-mapper';
import {
  getLiveValuesForParams,
  planUpdatesForParamChange,
} from '@/data/registry-binding';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MessageListProps {
  messages: readonly ChatMessage[];
  isLoading: boolean;
  onSelectGameType?: (gameTypeId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  MessageList                                                        */
/* ------------------------------------------------------------------ */

export function MessageList({
  messages,
  isLoading,
  onSelectGameType,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const l1State = useEditorStore((s) => s.l1State);
  const setL1State = useEditorStore((s) => s.setL1State);
  const config = useGameStore((s) => s.config);
  const setConfig = useGameStore((s) => s.setConfig);
  const batchUpdateParams = useGameStore((s) => s.batchUpdateParams);

  /* Compute last assistant message index for ChatBlock interactivity */
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* L1 experience change handler */
  const handleL1Change = useCallback(
    (partial: Record<string, string>) => {
      setL1State(partial);
      const next = { ...l1State, ...partial };
      const gameType = config?.meta?.name?.toLowerCase() ?? 'catch';
      const updates = applyL1Preset(
        { difficulty: String(next.difficulty), pacing: String(next.pacing), emotion: String(next.emotion) },
        gameType,
      );
      batchUpdateParams(updates);
    },
    [l1State, setL1State, config, batchUpdateParams],
  );

  /* Expert tuning apply handler */
  const handleApplyTuning = useCallback(
    (tuning: ModuleTuningPayload) => {
      if (!config) return;
      const updates: Array<{ moduleId: string; changes: Record<string, unknown> }> = [];

      for (const mod of tuning.modules) {
        const target = config.modules.find(
          (m) => m.type.toLowerCase() === mod.name.toLowerCase(),
        );
        if (!target) continue;

        const changes: Record<string, unknown> = {};
        for (const p of mod.params) {
          changes[p.name] =
            typeof p.value === 'string' && p.value.trim() !== '' && !isNaN(Number(p.value))
              ? Number(p.value)
              : p.value;
        }
        updates.push({ moduleId: target.id, changes });
      }

      if (updates.length > 0) batchUpdateParams(updates);
    },
    [config, batchUpdateParams],
  );

  /* Param change handler */
  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      if (!config) return;
      const plan = planUpdatesForParamChange(paramId, value, config);
      if (plan.meta) {
        setConfig({ ...config, meta: { ...config.meta, ...plan.meta } });
      }
      if (plan.params.length > 0) {
        batchUpdateParams(plan.params);
      }
    },
    [config, setConfig, batchUpdateParams],
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLatestAssistant={msg.role === 'assistant' && i === lastAssistantIndex}
          l1State={l1State}
          config={config}
          onL1Change={handleL1Change}
          onParamChange={handleParamChange}
          onApplyTuning={handleApplyTuning}
          onSelectGameType={onSelectGameType}
        />
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>思考中...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

interface BubbleProps {
  readonly message: ChatMessage;
  readonly isLatestAssistant: boolean;
  readonly l1State: { difficulty: string; pacing: number | string; emotion: string };
  readonly config: GameConfig | null;
  readonly onL1Change: (partial: Record<string, string>) => void;
  readonly onParamChange: (paramId: string, value: unknown) => void;
  readonly onApplyTuning: (tuning: ModuleTuningPayload) => void;
  readonly onSelectGameType?: (gameTypeId: string) => void;
}

function MessageBubble({
  message,
  isLatestAssistant,
  l1State,
  config,
  onL1Change,
  onParamChange,
  onApplyTuning,
  onSelectGameType,
}: BubbleProps) {
  const isUser = message.role === 'user';

  const liveValues = useMemo(
    () =>
      !isUser && message.parameterCard
        ? getLiveValuesForParams(config, message.parameterCard.paramIds)
        : {},
    [isUser, message.parameterCard, config],
  );

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white/5 text-gray-200 border border-white/5'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {!isUser && message.blocks && message.blocks.length > 0 && (
          <ChatBlockRenderer
            blocks={message.blocks}
            isLatestAssistant={isLatestAssistant}
            messageId={message.id}
          />
        )}

        {!isUser && message.l1Controls && (
          <L1ExperienceCard
            difficulty={String(l1State.difficulty)}
            pacing={String(l1State.pacing)}
            emotion={l1State.emotion}
            onDifficultyChange={(v) => onL1Change({ difficulty: v })}
            onPacingChange={(v) => onL1Change({ pacing: v })}
            onEmotionChange={(v) => onL1Change({ emotion: v })}
          />
        )}

        {!isUser && message.parameterCard && (
          <BespokeParamCard
            category={message.parameterCard.category}
            paramIds={message.parameterCard.paramIds}
            title={message.parameterCard.title}
            isActive={true}
            values={liveValues}
            onParamChange={onParamChange}
          />
        )}

        {!isUser && message.gameTypeOptions && (
          <GameTypeSelector
            options={message.gameTypeOptions}
            onSelect={(id) => onSelectGameType?.(id)}
          />
        )}

        {!isUser && message.expertInsight && (
          <ExpertInsightBlock title={message.expertInsight.title}>
            <p>{message.expertInsight.body}</p>
          </ExpertInsightBlock>
        )}

        {!isUser && message.moduleTuning && (
          <ModuleCombinationCard
            tuning={message.moduleTuning}
            onApply={() => onApplyTuning(message.moduleTuning!)}
          />
        )}

        {!isUser && message.presetUsed && (
          <PresetSuggestionBlock
            presetId={message.presetUsed.presetId}
            title={message.presetUsed.title}
            pendingAssets={message.presetUsed.pendingAssets}
          />
        )}
      </div>
    </div>
  );
}
