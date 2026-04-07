import { useCallback, useMemo } from 'react';
import { LandingPage } from '@/ui/landing/landing-page.tsx';
import { StudioChatPanel } from '@/ui/chat/studio-chat-panel.tsx';
import { PreviewCanvas } from '@/ui/preview/preview-canvas.tsx';
import { EditorPanel } from '@/ui/editor/editor-panel.tsx';
import { BoardModePanel } from '@/ui/parameters/board-mode-panel.tsx';
import { useEngine, EngineContext } from '@/app/hooks/use-engine.ts';
import { useEditorStore } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import {
  extractRegistryValueMap,
  planUpdatesForParamChange,
} from '@/data/registry-binding.ts';
import { FullscreenMode } from '@/ui/preview/fullscreen-mode.tsx';
import type { PreviewMode } from '@/store/editor-store.ts';
import { PanelRight, PanelRightClose } from 'lucide-react';
import { useResizeDivider } from '@/app/hooks/use-resize-divider.ts';

const selectPreviewMode = (s: { previewMode: PreviewMode }) => s.previewMode;
const selectLayoutPhase = (s: { layoutPhase: 'landing' | 'studio' }) => s.layoutPhase;
const selectEditorExpanded = (s: { editorExpanded: boolean }) => s.editorExpanded;
const selectToggleEditor = (s: { toggleEditor: () => void }) => s.toggleEditor;
const selectBoardModeOpen = (s: { boardModeOpen: boolean }) => s.boardModeOpen;
const selectSetBoardModeOpen = (s: { setBoardModeOpen: (open: boolean) => void }) =>
  s.setBoardModeOpen;

export function MainLayout() {
  const engine = useEngine();
  const previewMode = useEditorStore(selectPreviewMode);
  const layoutPhase = useEditorStore(selectLayoutPhase);
  const editorExpanded = useEditorStore(selectEditorExpanded);
  const toggleEditor = useEditorStore(selectToggleEditor);
  const boardModeOpen = useEditorStore(selectBoardModeOpen);
  const setBoardModeOpen = useEditorStore(selectSetBoardModeOpen);
  const {
    width: chatWidth,
    onMouseDown: handleMouseDown,
    onTouchStart: handleTouchStart,
  } = useResizeDivider(480);

  // Board Mode: live config bindings
  const config = useGameStore((s) => s.config);
  const batchUpdateParams = useGameStore((s) => s.batchUpdateParams);
  const setConfig = useGameStore((s) => s.setConfig);
  const gameType = config?.meta?.name?.toLowerCase() ?? 'catch';
  const values = useMemo(() => extractRegistryValueMap(config), [config]);
  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      if (!config) return;
      const plan = planUpdatesForParamChange(paramId, value, config);

      // Separate _enabled toggles from regular param updates
      const enableOps = plan.params.filter((p) => '_enabled' in p.changes);
      const paramOps = plan.params.filter((p) => !('_enabled' in p.changes));

      // Build a single merged config update for meta + enableOps to avoid stale closure
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

      // Handle regular param updates
      if (paramOps.length > 0) {
        batchUpdateParams(paramOps);
      }
    },
    [config, setConfig, batchUpdateParams],
  );

  const handleBoardModeClose = useCallback(
    () => setBoardModeOpen(false),
    [setBoardModeOpen],
  );

  return (
    <EngineContext.Provider value={engine}>
      {layoutPhase === 'landing' ? (
        <LandingPage />
      ) : (
        <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
          {/* Left: Chat Panel (with Board Mode slide-over) */}
          {previewMode === 'edit' && (
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
                    'absolute inset-0 z-30 transition-transform duration-300 ease-in-out',
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

              {/* Resizable Divider */}
              <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="w-1.5 shrink-0 -mx-0.75 cursor-col-resize hover:bg-blue-600/50 active:bg-blue-600 transition-colors z-20"
                title="拖动调整大小"
              />
            </>
          )}

          {/* Center: Preview Canvas */}
          <div className="flex-1 min-w-0 relative bg-black/20">
            <PreviewCanvas />

            {/* Editor toggle button */}
            {previewMode === 'edit' && (
              <button
                onClick={toggleEditor}
                className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
                title={editorExpanded ? '收起编辑器' : '展开编辑器'}
              >
                {editorExpanded ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
              </button>
            )}
          </div>

          {/* Right: Editor Panel (collapsed by default) */}
          {previewMode === 'edit' && editorExpanded && (
            <div className="w-80 shrink-0 border-l border-white/5">
              <EditorPanel />
            </div>
          )}
        </div>
      )}

      {previewMode === 'fullscreen' && <FullscreenMode />}
    </EngineContext.Provider>
  );
}
