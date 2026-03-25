import { useState, useRef, useEffect, useCallback } from 'react';
import { SendHorizontal, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import type { ChatMessage, Chip } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import { useEngineContext } from '@/app/hooks/use-engine.ts';
import { ConversationAgent } from '@/agent/conversation-agent.ts';
import type { ConversationResult } from '@/agent/conversation-agent.ts';
import { AssetAgent } from '@/services/asset-agent.ts';
import { SuggestionChips } from './suggestion-chips.tsx';

import type { GameConfig, AssetEntry } from '@/engine/core';

/* ------------------------------------------------------------------ */
/*  Singleton ConversationAgent                                        */
/* ------------------------------------------------------------------ */

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

let conversationAgentInstance: ConversationAgent | null = null;
function getConversationAgent(): ConversationAgent {
  if (conversationAgentInstance) return conversationAgentInstance;
  conversationAgentInstance = new ConversationAgent(apiKey);
  return conversationAgentInstance;
}

/* ------------------------------------------------------------------ */
/*  Stable Zustand selectors                                           */
/* ------------------------------------------------------------------ */

const selectChatMessages = (s: { chatMessages: ChatMessage[] }) => s.chatMessages;
const selectIsChatLoading = (s: { isChatLoading: boolean }) => s.isChatLoading;
const selectAddChatMessage = (s: { addChatMessage: (msg: ChatMessage) => void }) => s.addChatMessage;
const selectSetChatLoading = (s: { setChatLoading: (v: boolean) => void }) => s.setChatLoading;
const selectSetSuggestionChips = (s: { setSuggestionChips: (chips: Chip[]) => void }) => s.setSuggestionChips;
const selectConfig = (s: { config: GameConfig | null }) => s.config;
const selectSetConfig = (s: { setConfig: (c: GameConfig) => void }) => s.setConfig;
const selectBatchUpdateAssets = (s: { batchUpdateAssets: (a: Record<string, AssetEntry>) => void }) => s.batchUpdateAssets;

/* ------------------------------------------------------------------ */
/*  StudioChatPanel                                                    */
/* ------------------------------------------------------------------ */

export function StudioChatPanel() {
  const { engineRef } = useEngineContext();

  const chatMessages = useEditorStore(selectChatMessages);
  const isChatLoading = useEditorStore(selectIsChatLoading);
  const addChatMessage = useEditorStore(selectAddChatMessage);
  const setChatLoading = useEditorStore(selectSetChatLoading);
  const setSuggestionChips = useEditorStore(selectSetSuggestionChips);

  const config = useGameStore(selectConfig);
  const setConfig = useGameStore(selectSetConfig);
  const batchUpdateAssets = useGameStore(selectBatchUpdateAssets);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------- */
  /*  Auto-scroll to bottom on new messages                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ---------------------------------------------------------------- */
  /*  Asset fulfillment                                                */
  /* ---------------------------------------------------------------- */

  const triggerAssetFulfillment = useCallback(
    (newConfig: GameConfig) => {
      const assetAgent = new AssetAgent();

      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '\uD83C\uDFA8 \u6B63\u5728\u81EA\u52A8\u751F\u6210\u6E38\u620F\u7D20\u6750...',
        timestamp: Date.now(),
      });

      assetAgent
        .fulfillAssets(newConfig, (progress) => {
          console.log(
            `[StudioChat] Asset ${progress.key}: ${progress.status} (${progress.current}/${progress.total})`,
          );
        })
        .then((assets) => {
          const count = Object.keys(assets).length;
          if (count > 0) {
            batchUpdateAssets(assets);
            // Push new assets into the running engine so the renderer picks them up
            const engine = engineRef.current;
            if (engine) {
              const engineConfig = engine.getConfig();
              engineConfig.assets = { ...engineConfig.assets, ...assets };
            }
            addChatMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `\u2705 \u5DF2\u81EA\u52A8\u751F\u6210 ${count} \u4E2A\u6E38\u620F\u7D20\u6750\uFF01`,
              timestamp: Date.now(),
            });
          } else {
            // count === 0: either all assets cached, no assets needed, or no API key
            // Don't show a warning — this is normal when assets are already cached
          }
        })
        .catch((err) => {
          console.error('[StudioChat] Asset fulfillment failed:', err);
          addChatMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `\u274C \u7D20\u6750\u751F\u6210\u5931\u8D25: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
          });
        });
    },
    [addChatMessage, batchUpdateAssets, engineRef],
  );

  /* ---------------------------------------------------------------- */
  /*  Submit message to ConversationAgent                              */
  /* ---------------------------------------------------------------- */

  const submitToAgent = useCallback(
    async (text: string) => {
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
          content: `\u274C \u51FA\u9519\u4E86: ${errorText}`,
          timestamp: Date.now(),
        });
      } finally {
        setChatLoading(false);
      }
    },
    [addChatMessage, setChatLoading, config, setConfig, setSuggestionChips, triggerAssetFulfillment],
  );

  /* ---------------------------------------------------------------- */
  /*  Input handlers                                                   */
  /* ---------------------------------------------------------------- */

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isChatLoading) return;
    setInput('');
    void submitToAgent(text);
  }, [input, isChatLoading, submitToAgent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isChatLoading) {
        e.preventDefault();
        handleSend();
      }
    },
    [isChatLoading, handleSend],
  );

  /* ---------------------------------------------------------------- */
  /*  Chip click handler                                               */
  /* ---------------------------------------------------------------- */

  const handleChipClick = useCallback(
    (chip: Chip) => {
      if (isChatLoading) return;
      const text = chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label;
      void submitToAgent(text);
    },
    [isChatLoading, submitToAgent],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-white/5">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
          AI
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">
          AIGE Studio
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isChatLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2">
            <Loader2 size={14} className="animate-spin" />
            <span>\u601D\u8003\u4E2D...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      <SuggestionChips onChipClick={handleChipClick} />

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
          <textarea
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none max-h-24"
            placeholder="\u8F93\u5165\u4FEE\u6539\u5EFA\u8BAE..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isChatLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

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
      </div>
    </div>
  );
}
