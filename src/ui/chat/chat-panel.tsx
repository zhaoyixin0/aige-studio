import { useState, useRef, useEffect, useCallback } from 'react';
import { SendHorizontal, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import type { ChatMessage } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import { Agent } from '@/agent/index.ts';
import { AssetAgent } from '@/services/asset-agent.ts';

import type { GameConfig, AssetEntry } from '@/engine/core';

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

let agentInstance: Agent | null = null;
function getAgent(): Agent {
  if (agentInstance) return agentInstance;
  // Wizard-only flows don't need an API key, so we always create the agent.
  // The API key can be empty — it only matters for Claude API calls.
  agentInstance = new Agent(apiKey ?? '');
  return agentInstance;
}

/** Stable selectors — extracted to module scope so function references never change. */
const selectChatMessages = (s: { chatMessages: ChatMessage[] }) => s.chatMessages;
const selectIsChatLoading = (s: { isChatLoading: boolean }) => s.isChatLoading;
const selectAddChatMessage = (s: { addChatMessage: (message: ChatMessage) => void }) => s.addChatMessage;
const selectSetChatLoading = (s: { setChatLoading: (loading: boolean) => void }) => s.setChatLoading;
const selectTruncateChatAfter = (s: { truncateChatAfter: (messageId: string) => void }) => s.truncateChatAfter;
const selectConfig = (s: { config: GameConfig | null }) => s.config;
const selectSetConfig = (s: { setConfig: (config: GameConfig) => void }) => s.setConfig;
const selectBatchUpdateAssets = (s: { batchUpdateAssets: (assets: Record<string, AssetEntry>) => void }) => s.batchUpdateAssets;

/** Welcome message shown on first load. */
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '\u{1F44B} 欢迎使用 AIGE Studio！\n\n告诉我你想做什么游戏，或者点击下方按钮开始创建：',
  wizardChoices: [
    { id: '__start_wizard__', label: '开始创建游戏', emoji: '\u{1F680}' },
  ],
  timestamp: 0,
};

export function ChatPanel() {
  const chatMessages = useEditorStore(selectChatMessages);
  const isChatLoading = useEditorStore(selectIsChatLoading);
  const addChatMessage = useEditorStore(selectAddChatMessage);
  const truncateChatAfter = useEditorStore(selectTruncateChatAfter);
  const setChatLoading = useEditorStore(selectSetChatLoading);
  const config = useGameStore(selectConfig);
  const setConfig = useGameStore(selectSetConfig);
  const batchUpdateAssets = useGameStore(selectBatchUpdateAssets);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcomeShownRef = useRef(false);

  /** Fire-and-forget: generate assets for a newly created config. */
  const triggerAssetFulfillment = useCallback((newConfig: GameConfig) => {
    const assetAgent = new AssetAgent();

    addChatMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '\uD83C\uDFA8 \u6B63\u5728\u81EA\u52A8\u751F\u6210\u6E38\u620F\u7D20\u6750...',
      timestamp: Date.now(),
    });

    assetAgent.fulfillAssets(newConfig, (progress) => {
      console.log(`[AssetAgent] ${progress.key}: ${progress.status} (${progress.current}/${progress.total})`);
    }).then((assets) => {
      const count = Object.keys(assets).length;
      if (count > 0) {
        batchUpdateAssets(assets);
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `\u2705 \u5DF2\u81EA\u52A8\u751F\u6210 ${count} \u4E2A\u6E38\u620F\u7D20\u6750\uFF01\u7D20\u6750\u5DF2\u4FDD\u5B58\u5230\u7D20\u6750\u5E93\u3002`,
          timestamp: Date.now(),
        });
      } else {
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '\u26A0\uFE0F \u7D20\u6750\u751F\u6210\u8DF3\u8FC7\uFF08\u53EF\u80FD\u672A\u914D\u7F6E Gemini API Key \u6216\u65E0\u9700\u751F\u6210\u7684\u7D20\u6750\uFF09',
          timestamp: Date.now(),
        });
      }
    }).catch((err) => {
      console.error('Asset fulfillment failed:', err);
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `\u274C \u7D20\u6750\u751F\u6210\u5931\u8D25: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
    });
  }, [addChatMessage, batchUpdateAssets]);

  // Show welcome message on first render if chat is empty
  useEffect(() => {
    if (!welcomeShownRef.current && chatMessages.length === 0) {
      welcomeShownRef.current = true;
      addChatMessage(WELCOME_MESSAGE);
    }
  }, [chatMessages.length, addChatMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /** Handle an enhancement suggestion click. */
  const handleEnhancement = useCallback((enhancementId: string) => {
    const agent = getAgent();
    if (!config) return;

    addChatMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `\u{1F527} ${enhancementId}`,
      timestamp: Date.now(),
    });

    const response = agent.handleEnhancement(enhancementId, config);
    if (!response) return;

    if (response.config) {
      setConfig(response.config);
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.message,
      suggestions: response.suggestions.length > 0 ? response.suggestions : undefined,
      wizardChoices: response.wizardChoices,
      wizardStep: response.wizardStep,
      enhancementSuggestions: response.enhancementSuggestions,
      timestamp: Date.now(),
    };
    addChatMessage(assistantMsg);
  }, [config, addChatMessage, setConfig]);

  /** Handle a wizard button click. Supports re-selection from previous steps. */
  const handleWizardChoice = useCallback((choiceId: string, sourceMessageId?: string) => {
    const agent = getAgent();

    if (choiceId === '__start_wizard__') {
      const response = agent.startWizard();

      addChatMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: '\u{1F680} \u5F00\u59CB\u521B\u5EFA\u6E38\u620F',
        timestamp: Date.now(),
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        wizardChoices: response.wizardChoices,
        wizardStep: response.wizardStep,
        timestamp: Date.now(),
      };
      addChatMessage(assistantMsg);
      return;
    }

    // If clicking on a PREVIOUS step's choices (not the latest), rewind the wizard
    if (sourceMessageId) {
      const lastWizardMsg = [...chatMessages].reverse().find(
        (m) => m.role === 'assistant' && m.wizardStep,
      );
      const isCurrentStep = lastWizardMsg?.id === sourceMessageId;

      if (!isCurrentStep) {
        const sourceMsg = chatMessages.find((m) => m.id === sourceMessageId);
        if (sourceMsg?.wizardStep) {
          const srcIdx = chatMessages.findIndex((m) => m.id === sourceMessageId);
          const nextMsg = srcIdx >= 0 && srcIdx + 1 < chatMessages.length ? chatMessages[srcIdx + 1] : null;
          if (nextMsg) {
            truncateChatAfter(nextMsg.id);
          }
          agent.goToWizardStep(sourceMsg.wizardStep as any);
        }
      }
    }

    // Wizard is active — feed the choice
    if (agent.isWizardActive()) {
      // Resolve label from source message (avoids stale closure after truncation)
      const sourceMsg = sourceMessageId
        ? chatMessages.find((m) => m.id === sourceMessageId)
        : [...chatMessages].reverse().find((m) => m.role === 'assistant' && m.wizardChoices);
      const choiceDef = sourceMsg?.wizardChoices?.find((c) => c.id === choiceId);
      const userLabel = choiceDef
        ? `${choiceDef.emoji ? choiceDef.emoji + ' ' : ''}${choiceDef.label}`
        : choiceId;

      addChatMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: userLabel,
        timestamp: Date.now(),
      });

      const response = agent.answerWizard(choiceId);

      if (response.config) {
        setConfig(response.config);
      }

      // Progressive preview: load partial config after each step
      if (!response.config) {
        const partialConfig = agent.getWizardPartialConfig();
        if (partialConfig) {
          setConfig(partialConfig);
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        suggestions: response.suggestions.length > 0 ? response.suggestions : undefined,
        wizardChoices: response.wizardChoices,
        wizardStep: response.wizardStep,
        enhancementSuggestions: response.enhancementSuggestions,
        timestamp: Date.now(),
      };
      addChatMessage(assistantMsg);

      // Auto-generate assets when wizard produces a final config
      if (response.config) {
        triggerAssetFulfillment(response.config);
      }
      return;
    }

    // Not wizard — treat as free-text input (for guided creator quick replies)
    const sourceMsg = sourceMessageId
      ? chatMessages.find((m) => m.id === sourceMessageId)
      : null;
    const choiceDef = sourceMsg?.wizardChoices?.find((c) => c.id === choiceId);
    const label = choiceDef?.label ?? choiceId;
    void handleSend(label);
  }, [chatMessages, addChatMessage, truncateChatAfter, setConfig, triggerAssetFulfillment]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    if (!overrideText) setInput('');

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    addChatMessage(userMessage);

    const agent = getAgent();

    // If wizard is active, route through wizard
    if (agent.isWizardActive()) {
      const response = agent.answerWizard(text);

      if (response.config) {
        setConfig(response.config);
      }

      // Progressive preview: load partial config after each step
      if (!response.config) {
        const partialConfig = agent.getWizardPartialConfig();
        if (partialConfig) {
          setConfig(partialConfig);
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        suggestions: response.suggestions.length > 0 ? response.suggestions : undefined,
        wizardChoices: response.wizardChoices,
        wizardStep: response.wizardStep,
        enhancementSuggestions: response.enhancementSuggestions,
        timestamp: Date.now(),
      };
      addChatMessage(assistantMsg);

      // Auto-generate assets when wizard produces a final config
      if (response.config) {
        triggerAssetFulfillment(response.config);
      }
      return;
    }

    // Check if user wants to create a game — start wizard (no API needed)
    const createGamePatterns = [
      /做.{0,4}游戏/,
      /创建.{0,4}游戏/,
      /新建.{0,4}游戏/,
      /开始创建/,
      /make.{0,6}game/i,
      /create.{0,6}game/i,
      /new.{0,6}game/i,
    ];
    if (createGamePatterns.some((re) => re.test(text))) {
      const response = agent.startWizard();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        wizardChoices: response.wizardChoices,
        wizardStep: response.wizardStep,
        timestamp: Date.now(),
      };
      addChatMessage(assistantMsg);
      return;
    }

    // Mode B: detect game type from free-text description
    const modeBResult = agent.tryModeBAutoBuild(text);
    if (modeBResult) {
      if (modeBResult.config) {
        setConfig(modeBResult.config);
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: modeBResult.message,
        suggestions: modeBResult.suggestions.length > 0 ? modeBResult.suggestions : undefined,
        wizardChoices: modeBResult.wizardChoices,
        enhancementSuggestions: modeBResult.enhancementSuggestions,
        timestamp: Date.now(),
      };
      addChatMessage(assistantMsg);

      // Auto-generate assets for Mode B config
      if (modeBResult.config) {
        triggerAssetFulfillment(modeBResult.config);
      }
      return;
    }

    // Non-wizard path — use API-based agent
    if (!apiKey) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'API key 未配置。请在 .env 文件中设置 VITE_ANTHROPIC_API_KEY。\n\n你仍然可以使用向导创建游戏 — 点击"开始创建游戏"按钮。',
        wizardChoices: [
          { id: '__start_wizard__', label: '开始创建游戏', emoji: '\u{1F680}' },
        ],
        timestamp: Date.now(),
      });
      return;
    }

    setChatLoading(true);
    try {
      const response = await agent.process(text, config);

      if (response.config) {
        setConfig(response.config);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        suggestions:
          response.suggestions.length > 0 ? response.suggestions : undefined,
        wizardChoices: response.wizardChoices,
        enhancementSuggestions: response.enhancementSuggestions,
        timestamp: Date.now(),
      };

      addChatMessage(assistantMessage);

      // Auto-generate assets when a config is produced (guided creator or recipe)
      if (response.config) {
        triggerAssetFulfillment(response.config);
      }
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : 'Unknown error occurred';
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorText}`,
        timestamp: Date.now(),
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isChatLoading) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-white/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <MessageSquare size={14} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Chat
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {chatMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onWizardChoice={handleWizardChoice}
            onEnhancement={handleEnhancement}
          />
        ))}

        {isChatLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2">
            <Loader2 size={14} className="animate-spin" />
            思考中...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
          <textarea
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none max-h-24"
            placeholder="描述你想做的游戏..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={() => void handleSend()}
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

function MessageBubble({
  message,
  onWizardChoice,
  onEnhancement,
}: {
  message: ChatMessage;
  onWizardChoice: (choiceId: string, sourceMessageId?: string) => void;
  onEnhancement: (enhancementId: string) => void;
}) {
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

        {/* Wizard choice buttons */}
        {message.wizardChoices && message.wizardChoices.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.wizardChoices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => onWizardChoice(choice.id, message.id)}
                className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-sm text-blue-300 transition-colors cursor-pointer"
                title={choice.description}
              >
                {choice.emoji && <span className="mr-1">{choice.emoji}</span>}
                {choice.label}
              </button>
            ))}
          </div>
        )}

        {/* Enhancement suggestion buttons */}
        {message.enhancementSuggestions && message.enhancementSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 border-t border-white/10 pt-3">
            {message.enhancementSuggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onEnhancement(s.id)}
                className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-sm text-emerald-300 transition-colors cursor-pointer"
              >
                <span className="mr-1">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestion chips */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            {message.suggestions.map((s, i) => (
              <div key={i} className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">
                  <Sparkles size={10} className="inline mr-1" />
                  {s.moduleType}
                </span>
                {' \u2014 '}
                {s.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
