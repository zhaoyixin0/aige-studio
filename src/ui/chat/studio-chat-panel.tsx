import { useState, useCallback } from 'react';
import { SendHorizontal } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { type ChatMessage, type Chip, getPresetIdFromChip } from '@/store/editor-store';
import { useConversationManager } from '@/app/hooks/use-conversation-manager';
import { MessageList } from './message-list';
import { SuggestionChips } from './suggestion-chips';

/* ------------------------------------------------------------------ */
/*  Stable Zustand selectors                                           */
/* ------------------------------------------------------------------ */

const selectChatMessages = (s: { chatMessages: ChatMessage[] }) => s.chatMessages;
const selectIsChatLoading = (s: { isChatLoading: boolean }) => s.isChatLoading;
const selectSuggestionChips = (s: { suggestionChips: Chip[] }) => s.suggestionChips;
const selectAddChatMessage = (s: { addChatMessage: (msg: ChatMessage) => void }) =>
  s.addChatMessage;

/* ------------------------------------------------------------------ */
/*  StudioChatPanel                                                    */
/* ------------------------------------------------------------------ */

export function StudioChatPanel() {
  const chatMessages = useEditorStore(selectChatMessages);
  const isChatLoading = useEditorStore(selectIsChatLoading);
  const chips = useEditorStore(selectSuggestionChips);
  const addChatMessage = useEditorStore(selectAddChatMessage);

  const { submitMessage } = useConversationManager();

  const [input, setInput] = useState('');

  /* ---------------------------------------------------------------- */
  /*  Input handlers                                                   */
  /* ---------------------------------------------------------------- */

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isChatLoading) return;
    setInput('');
    void submitMessage(text);
  }, [input, isChatLoading, submitMessage]);

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
      // For param/action chips, include structured data in the message
      if (chip.type === 'param' && chip.paramId) {
        void submitMessage(`调整参数: ${chip.label} [${chip.paramId}]`);
        return;
      }
      if (chip.type === 'action' && chip.action) {
        void submitMessage(`执行操作: ${chip.label} [${chip.action}]`);
        return;
      }
      // For preset chips, send as "使用模板 <presetId>"
      const presetId = getPresetIdFromChip(chip);
      if (presetId) {
        void submitMessage(`使用模板 ${presetId}`);
        return;
      }
      // For game_type chips, generate a GameTypeSelector message
      if (chip.type === 'game_type') {
        const gameTypeOptions = chips
          .filter((c) => c.type === 'game_type')
          .map((c) => ({ id: c.id, name: c.label, emoji: c.emoji }));

        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '请选择游戏类型：',
          gameTypeOptions,
          timestamp: Date.now(),
        });
        return;
      }
      const text = chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label;
      void submitMessage(text);
    },
    [isChatLoading, submitMessage, chips, addChatMessage],
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
      <MessageList messages={chatMessages} isLoading={isChatLoading} />

      {/* Suggestion chips */}
      <SuggestionChips onChipClick={handleChipClick} />

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
          <textarea
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none max-h-24"
            placeholder="输入修改建议..."
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
