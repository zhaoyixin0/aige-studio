import { useState, useCallback } from 'react';
import { Image as ImageIcon, SendHorizontal, Square, X } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';
import { useChatInputPaste } from '@/app/hooks/use-chat-input-paste';
import { type ChatMessage, type Chip, getPresetIdFromChip } from '@/store/editor-store';
// Chip type retained for handleChipClick signature even though chips list is no longer read here.
import { useConversationManager } from '@/app/hooks/use-conversation-manager';
import { usePresetEnrichment } from '@/app/hooks/use-preset-enrichment';
import { usePresetAdvice } from '@/app/hooks/use-preset-advice';
import { PresetEnrichmentBadge } from './preset-enrichment-badge';
import { buildFullGameTypeOptions } from '@/agent/game-type-options';
import { MessageList } from './message-list';
import { L3PillsPanel } from './l3-pills-panel';
import { SuggestionChips } from './suggestion-chips';
import { ExpertBrowser } from '@/ui/experts/expert-browser';
import { AssetBrowser } from '@/ui/assets/asset-browser';

/* ------------------------------------------------------------------ */
/*  Stable Zustand selectors                                           */
/* ------------------------------------------------------------------ */

const selectChatMessages = (s: { chatMessages: ChatMessage[] }) => s.chatMessages;
const selectIsChatLoading = (s: { isChatLoading: boolean }) => s.isChatLoading;
const selectAddChatMessage = (s: { addChatMessage: (msg: ChatMessage) => void }) =>
  s.addChatMessage;

/* ------------------------------------------------------------------ */
/*  StudioChatPanel                                                    */
/* ------------------------------------------------------------------ */

export function StudioChatPanel() {
  const chatMessages = useEditorStore(selectChatMessages);
  const isChatLoading = useEditorStore(selectIsChatLoading);
  const addChatMessage = useEditorStore(selectAddChatMessage);
  const expertBrowserOpen = useEditorStore((s) => s.expertBrowserOpen);
  const expertBrowserGameType = useEditorStore((s) => s.expertBrowserGameType);
  const setExpertBrowserOpen = useEditorStore((s) => s.setExpertBrowserOpen);

  // Asset fulfillment state — when isActive, show stop button instead of send.
  const isFulfillmentActive = useAssetFulfillmentStore((s) => s.isActive);
  const cancelFulfillment = useAssetFulfillmentStore((s) => s.cancel);

  const { submitMessage } = useConversationManager();

  // P2 async skill pass — subscribes to game-store, runs preset-enricher
  // in the background after hero preset loads, merges diff with field-level
  // user-edit protection. Also exposes a cancel hook that UI can wire up to
  // a progress block.
  const enrichment = usePresetEnrichment();

  // P3 signature-drift advice — once a preset is enriched, compare against
  // the expert-card signature and push advice chat blocks if parameters
  // drift beyond the per-key tolerance.
  usePresetAdvice();

  const [input, setInput] = useState('');
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);

  const openAssetDrawer = useCallback(() => setAssetDrawerOpen(true), []);
  const closeAssetDrawer = useCallback(() => setAssetDrawerOpen(false), []);
  const handleAssetSelect = useCallback(() => {
    // Future: thread the selected asset into the input as an attachment.
    // For now, simply close the drawer to acknowledge the selection.
    setAssetDrawerOpen(false);
  }, []);

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
      // For game_type chips, generate a GameTypeSelector message that shows
      // the FULL game type catalog (not just the curated chip subset).
      // The selector UI handles search / category tabs / show-more on its own.
      if (chip.type === 'game_type') {
        // Carry the full GameTypeOption shape (incl. category / supportedToday)
        // through the message — runtime data is preserved even though
        // ChatMessage.gameTypeOptions is typed narrowly upstream.
        const fullOptions = buildFullGameTypeOptions();
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '请选择游戏类型：',
          gameTypeOptions: fullOptions.map((o) => ({
            id: o.id,
            name: o.name,
            emoji: o.emoji,
            category: o.category,
            supportedToday: o.supportedToday,
            thumbnailUrl: o.thumbnailUrl,
          })) as ChatMessage['gameTypeOptions'],
          timestamp: Date.now(),
        };
        addChatMessage(newMessage);
        return;
      }
      const text = chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label;
      void submitMessage(text);
    },
    [isChatLoading, submitMessage, addChatMessage],
  );

  const paste = useChatInputPaste();

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

      {/* Preset enrichment status indicator */}
      <PresetEnrichmentBadge
        state={enrichment.state}
        applied={enrichment.applied}
        skipped={enrichment.skipped}
        onCancel={enrichment.cancelEnrichment}
      />

      {/* L3 parameter pills */}
      <L3PillsPanel />

      {/* Suggestion chips */}
      <SuggestionChips onChipClick={handleChipClick} />

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div
          role="region"
          aria-label="输入框 — 可拖放或粘贴图片"
          className={`flex items-end gap-2 bg-white/5 rounded-lg border px-3 py-2 ${
            paste.isDragging ? 'border-blue-500/60 ring-1 ring-blue-500/40' : 'border-white/10'
          }`}
          onDragOver={paste.handleDragOver}
          onDragLeave={paste.handleDragLeave}
          onDrop={paste.handleDrop}
        >
          <textarea
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none max-h-24"
            placeholder="输入修改建议..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={paste.handlePaste}
            rows={1}
            disabled={isChatLoading}
          />
          <button
            type="button"
            onClick={openAssetDrawer}
            aria-label="打开素材库"
            title="打开素材库"
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <ImageIcon size={16} />
          </button>
          {isFulfillmentActive ? (
            <button
              type="button"
              onClick={cancelFulfillment}
              aria-label="停止生成"
              title="停止生成"
              className="bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors rounded p-1"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isChatLoading}
              aria-label="发送"
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
            >
              <SendHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Asset Library slide-over drawer */}
      {assetDrawerOpen && (
        <div
          data-testid="asset-drawer"
          className="absolute top-0 left-0 right-0 bottom-0 z-40 bg-gray-950/95 backdrop-blur-xl border-r border-white/5 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">素材库</span>
            <button
              type="button"
              onClick={closeAssetDrawer}
              aria-label="关闭素材库"
              title="关闭素材库"
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <AssetBrowser onSelect={handleAssetSelect} />
          </div>
        </div>
      )}

      {/* Expert Browser Modal */}
      <ExpertBrowser
        isOpen={expertBrowserOpen}
        onClose={() => setExpertBrowserOpen(false)}
        onUsePreset={(id) => {
          setExpertBrowserOpen(false);
          void submitMessage(`使用模板 ${id}`);
        }}
        initialGameType={expertBrowserGameType ?? undefined}
      />
    </div>
  );
}
