import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LandingPage } from '@/ui/landing/landing-page.tsx';
import { StudioChatPanel } from '@/ui/chat/studio-chat-panel.tsx';
import { PreviewCanvas } from '@/ui/preview/preview-canvas.tsx';
import { EditorPanel } from '@/ui/editor/editor-panel.tsx';
import { BoardModePanel } from '@/ui/parameters/board-mode-panel.tsx';
import { useEngine, EngineContext } from '@/app/hooks/use-engine.ts';
import {
  useEditorStore,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_MAX,
  EDITOR_WIDTH_MIN,
  EDITOR_WIDTH_MAX,
} from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import {
  extractRegistryValueMap,
  planUpdatesForParamChange,
} from '@/data/registry-binding.ts';
import { FullscreenMode } from '@/ui/preview/fullscreen-mode.tsx';
import { setupUIActionExecutor } from '@/ui/chat/ui-action-executor.ts';
import type { PreviewMode } from '@/store/editor-store.ts';
import { PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from 'lucide-react';
import { useResizeDivider } from '@/app/hooks/use-resize-divider.ts';

const selectPreviewMode = (s: { previewMode: PreviewMode }) => s.previewMode;
const selectLayoutPhase = (s: { layoutPhase: 'landing' | 'studio' }) => s.layoutPhase;
const selectChatVisible = (s: { chatVisible: boolean }) => s.chatVisible;
const selectEditorVisible = (s: { editorVisible: boolean }) => s.editorVisible;
const selectChatWidth = (s: { chatWidth: number }) => s.chatWidth;
const selectEditorWidth = (s: { editorWidth: number }) => s.editorWidth;
const selectToggleChatVisible = (s: { toggleChatVisible: () => void }) => s.toggleChatVisible;
const selectToggleEditorVisible = (s: { toggleEditorVisible: () => void }) =>
  s.toggleEditorVisible;
const selectSetChatWidth = (s: { setChatWidth: (w: number) => void }) => s.setChatWidth;
const selectSetEditorWidth = (s: { setEditorWidth: (w: number) => void }) => s.setEditorWidth;
const selectBoardModeOpen = (s: { boardModeOpen: boolean }) => s.boardModeOpen;
const selectSetBoardModeOpen = (s: { setBoardModeOpen: (open: boolean) => void }) =>
  s.setBoardModeOpen;

export function MainLayout() {
  const engine = useEngine();
  const previewMode = useEditorStore(selectPreviewMode);
  const layoutPhase = useEditorStore(selectLayoutPhase);
  const chatVisible = useEditorStore(selectChatVisible);
  const editorVisible = useEditorStore(selectEditorVisible);
  const chatWidth = useEditorStore(selectChatWidth);
  const editorWidth = useEditorStore(selectEditorWidth);
  const toggleChatVisible = useEditorStore(selectToggleChatVisible);
  const toggleEditorVisible = useEditorStore(selectToggleEditorVisible);
  const setChatWidth = useEditorStore(selectSetChatWidth);
  const setEditorWidth = useEditorStore(selectSetEditorWidth);
  const boardModeOpen = useEditorStore(selectBoardModeOpen);
  const setBoardModeOpen = useEditorStore(selectSetBoardModeOpen);

  // Left divider — drives chatWidth
  const chatDivider = useResizeDivider(chatWidth, {
    minWidth: CHAT_WIDTH_MIN,
    maxWidth: CHAT_WIDTH_MAX,
    direction: 'left',
  });
  // Right divider — drives editorWidth (drag-left grows editor)
  const editorDivider = useResizeDivider(editorWidth, {
    minWidth: EDITOR_WIDTH_MIN,
    maxWidth: EDITOR_WIDTH_MAX,
    direction: 'right',
  });

  // Sync local divider widths back into store on change
  useEffect(() => {
    if (chatDivider.width !== chatWidth) setChatWidth(chatDivider.width);
  }, [chatDivider.width, chatWidth, setChatWidth]);
  useEffect(() => {
    if (editorDivider.width !== editorWidth) setEditorWidth(editorDivider.width);
  }, [editorDivider.width, editorWidth, setEditorWidth]);

  // Wire UIAction executor (global event handler)
  useEffect(() => {
    const cleanup = setupUIActionExecutor();
    return cleanup;
  }, []);

  // Board Mode: live config bindings
  const config = useGameStore((s) => s.config);
  const batchUpdateParams = useGameStore((s) => s.batchUpdateParams);
  const setConfig = useGameStore((s) => s.setConfig);
  const gameType = config?.meta?.name?.toLowerCase() ?? 'catch';
  const values = useMemo(() => extractRegistryValueMap(config), [config]);

  // Debounce engine reload during high-frequency Board Mode param changes (slider drags).
  const reloadTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current !== null) {
        window.clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, []);

  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      if (!config) return;
      const plan = planUpdatesForParamChange(paramId, value, config);

      const enableOps = plan.params.filter((p) => '_enabled' in p.changes);
      const paramOps = plan.params.filter((p) => !('_enabled' in p.changes));

      if (plan.meta || enableOps.length > 0) {
        let next = config;
        if (plan.meta) {
          next = { ...next, meta: { ...next.meta, ...plan.meta } };
        }
        if (enableOps.length > 0) {
          next = {
            ...next,
            modules: next.modules.map((m) => {
              const op = enableOps.find((e) => e.moduleId === m.id);
              if (!op) return m;
              return { ...m, enabled: Boolean(op.changes._enabled) };
            }),
          };
        }
        setConfig(next);
      }

      if (paramOps.length > 0) {
        batchUpdateParams(paramOps);
      }

      if (reloadTimeoutRef.current !== null) {
        window.clearTimeout(reloadTimeoutRef.current);
      }
      reloadTimeoutRef.current = window.setTimeout(() => {
        const latest = useGameStore.getState().config;
        if (latest) {
          engine.loadConfig(latest);
        }
        reloadTimeoutRef.current = null;
      }, 150);
    },
    [config, setConfig, batchUpdateParams, engine],
  );

  const handleBoardModeClose = useCallback(
    () => setBoardModeOpen(false),
    [setBoardModeOpen],
  );

  const showStudioPanels = previewMode === 'edit';
  const showChat = showStudioPanels && chatVisible;
  const showEditor = showStudioPanels && editorVisible;

  return (
    <EngineContext.Provider value={engine}>
      {layoutPhase === 'landing' ? (
        <LandingPage />
      ) : (
        <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
          {/* Left: Chat Panel + Board Mode overlay */}
          {showChat && (
            <>
              <div
                className="shrink-0 border-r border-white/5 bg-gray-950/50 backdrop-blur-xl relative overflow-hidden"
                style={{ width: chatWidth }}
              >
                <StudioChatPanel />

                {/* Board Mode slide-over overlay */}
                <div
                  data-testid="board-mode-container"
                  className={[
                    'absolute top-0 left-0 right-0 bottom-[80px] z-30 transition-transform duration-300 ease-in-out',
                    boardModeOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
                  ].join(' ')}
                >
                  {boardModeOpen && (
                    <BoardModePanel
                      gameType={gameType}
                      values={values}
                      onParamChange={handleParamChange}
                      onClose={handleBoardModeClose}
                    />
                  )}
                </div>
              </div>

              <div
                onMouseDown={chatDivider.onMouseDown}
                onTouchStart={chatDivider.onTouchStart}
                className="w-1.5 shrink-0 -mx-0.75 cursor-col-resize hover:bg-blue-600/50 active:bg-blue-600 transition-colors z-20"
                title="拖动调整对话宽度"
              />
            </>
          )}

          {/* Center: Preview Canvas */}
          <div className="flex-1 min-w-0 relative bg-black/20">
            <PreviewCanvas />

            {showStudioPanels && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <button
                  onClick={toggleChatVisible}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
                  title={chatVisible ? '隐藏对话面板' : '显示对话面板'}
                  aria-label={chatVisible ? '隐藏对话' : '显示对话'}
                >
                  {chatVisible ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                </button>
                <button
                  onClick={toggleEditorVisible}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
                  title={editorVisible ? '隐藏编辑器' : '显示编辑器'}
                  aria-label={editorVisible ? '隐藏编辑器' : '显示编辑器'}
                >
                  {editorVisible ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
                </button>
              </div>
            )}
          </div>

          {/* Right: Editor Panel + divider */}
          {showEditor && (
            <>
              <div
                onMouseDown={editorDivider.onMouseDown}
                onTouchStart={editorDivider.onTouchStart}
                className="w-1.5 shrink-0 -mx-0.75 cursor-col-resize hover:bg-blue-600/50 active:bg-blue-600 transition-colors z-20"
                title="拖动调整编辑器宽度"
              />
              <div
                className="shrink-0 border-l border-white/5"
                style={{ width: editorWidth }}
              >
                <EditorPanel />
              </div>
            </>
          )}
        </div>
      )}

      {previewMode === 'fullscreen' && <FullscreenMode />}
    </EngineContext.Provider>
  );
}
