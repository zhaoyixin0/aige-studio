import { useCallback, useEffect, useRef, useState } from 'react';
import { SendHorizontal, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { type ChatMessage, type Chip, getPresetIdFromChip } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import { SuggestionChips } from '@/ui/chat/suggestion-chips';
import { FeaturedExpertChip } from '@/ui/experts/featured-expert-chip';
import { ExpertBrowser } from '@/ui/experts/expert-browser';
import type { ConversationResult } from '@/agent/conversation-agent';
import { getConversationAgent } from '@/agent/singleton';
import { AssetAgent } from '@/services/asset-agent';

/* ------------------------------------------------------------------ */
/*  Landing Page                                                       */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMessages = useEditorStore((s) => s.chatMessages);
  const addChatMessage = useEditorStore((s) => s.addChatMessage);
  const setLayoutPhase = useEditorStore((s) => s.setLayoutPhase);
  const setSuggestionChips = useEditorStore((s) => s.setSuggestionChips);
  const setChatLoading = useEditorStore((s) => s.setChatLoading);
  const expertBrowserOpen = useEditorStore((s) => s.expertBrowserOpen);
  const expertBrowserGameType = useEditorStore((s) => s.expertBrowserGameType);
  const setExpertBrowserOpen = useEditorStore((s) => s.setExpertBrowserOpen);

  const setConfig = useGameStore((s) => s.setConfig);
  const batchUpdateAssets = useGameStore((s) => s.batchUpdateAssets);
  const currentConfig = useGameStore((s) => s.config);

  const { loadConfig } = useEngineContext();

  // Auto-scroll messages into view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  /* ---------------------------------------------------------------- */
  /*  Submit handler                                                   */
  /* ---------------------------------------------------------------- */

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput('');
      setLoading(true);
      setChatLoading(true);

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      addChatMessage(userMsg);

      try {
        const agent = getConversationAgent();
        const result: ConversationResult = await agent.process(trimmed, currentConfig ?? undefined);

        // Add assistant reply
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          timestamp: Date.now(),
        };
        addChatMessage(assistantMsg);

        // Update chips
        if (result.chips) {
          setSuggestionChips(result.chips);
        }

        // Config created — transition to studio
        if (result.config) {
          setConfig(result.config);
          loadConfig(result.config);
          setLayoutPhase('studio');

          // Fulfill assets in background
          fulfillAssetsInBackground(result.config);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorReply: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `出错了：${errMsg}`,
          timestamp: Date.now(),
        };
        addChatMessage(errorReply);
      } finally {
        setLoading(false);
        setChatLoading(false);
      }
    },
    [loading, currentConfig, addChatMessage, setConfig, loadConfig, setLayoutPhase, setSuggestionChips, setChatLoading],
  );

  /* ---------------------------------------------------------------- */
  /*  Asset fulfillment (background)                                   */
  /* ---------------------------------------------------------------- */

  const fulfillAssetsInBackground = useCallback(
    async (config: import('@/engine/core').GameConfig) => {
      try {
        const assetAgent = new AssetAgent();
        const assets = await assetAgent.fulfillAssets(config);
        if (Object.keys(assets).length > 0) {
          batchUpdateAssets(assets);
          // Reload engine config with updated assets
          const updatedConfig = useGameStore.getState().config;
          if (updatedConfig) {
            loadConfig(updatedConfig);
          }
        }
      } catch (err) {
        console.warn('[LandingPage] Asset fulfillment failed:', err);
      }
    },
    [batchUpdateAssets, loadConfig],
  );

  /* ---------------------------------------------------------------- */
  /*  Chip click → submit as if typed                                  */
  /* ---------------------------------------------------------------- */

  const handleChipClick = useCallback(
    (chip: Chip) => {
      const presetId = getPresetIdFromChip(chip);
      if (presetId) {
        handleSubmit(`使用模板 ${presetId}`);
      } else {
        handleSubmit(chip.label);
      }
    },
    [handleSubmit],
  );

  /* ---------------------------------------------------------------- */
  /*  Key handler (Enter to send, Shift+Enter for newline)             */
  /* ---------------------------------------------------------------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(input);
      }
    },
    [input, handleSubmit],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const hasMessages = chatMessages.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-4">
      <div className="flex flex-col items-center w-full max-w-2xl">
        {/* Title area */}
        {!hasMessages && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">AIGE Studio</h1>
            <p className="text-gray-400 text-base">
              描述你想做的游戏，AI 帮你创建
            </p>
          </div>
        )}

        {/* Chat history */}
        {hasMessages && (
          <div className="w-full max-h-[50vh] overflow-y-auto mb-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-gray-400 rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  思考中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 focus-within:border-white/20 transition-colors">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想做的游戏..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none outline-none min-h-[36px] max-h-[160px] py-1.5"
            />
            <button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SendHorizontal className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="w-full mt-3">
          <SuggestionChips onChipClick={handleChipClick} />
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <FeaturedExpertChip onUse={(id) => handleSubmit(`使用模板 ${id}`)} />
              <button
                type="button"
                onClick={() => setExpertBrowserOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                  text-purple-400 hover:text-purple-200 hover:bg-purple-500/10
                  border border-purple-500/20 hover:border-purple-400/40
                  transition-colors duration-200"
              >
                浏览全部专家模板
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expert Browser Modal */}
      <ExpertBrowser
        isOpen={expertBrowserOpen}
        onClose={() => setExpertBrowserOpen(false)}
        onUsePreset={(id) => {
          setExpertBrowserOpen(false);
          handleSubmit(`使用模板 ${id}`);
        }}
        initialGameType={expertBrowserGameType ?? undefined}
      />
    </div>
  );
}
