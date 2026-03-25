import { LandingPage } from '@/ui/landing/landing-page.tsx';
import { StudioChatPanel } from '@/ui/chat/studio-chat-panel.tsx';
import { PreviewCanvas } from '@/ui/preview/preview-canvas.tsx';
import { EditorPanel } from '@/ui/editor/editor-panel.tsx';
import { useEngine, EngineContext } from '@/app/hooks/use-engine.ts';
import { useEditorStore } from '@/store/editor-store.ts';
import { FullscreenMode } from '@/ui/preview/fullscreen-mode.tsx';
import type { PreviewMode } from '@/store/editor-store.ts';
import { PanelRight, PanelRightClose } from 'lucide-react';

const selectPreviewMode = (s: { previewMode: PreviewMode }) => s.previewMode;
const selectLayoutPhase = (s: { layoutPhase: 'landing' | 'studio' }) => s.layoutPhase;
const selectEditorExpanded = (s: { editorExpanded: boolean }) => s.editorExpanded;
const selectToggleEditor = (s: { toggleEditor: () => void }) => s.toggleEditor;

export function MainLayout() {
  const engine = useEngine();
  const previewMode = useEditorStore(selectPreviewMode);
  const layoutPhase = useEditorStore(selectLayoutPhase);
  const editorExpanded = useEditorStore(selectEditorExpanded);
  const toggleEditor = useEditorStore(selectToggleEditor);

  return (
    <EngineContext.Provider value={engine}>
      {layoutPhase === 'landing' ? (
        <LandingPage />
      ) : (
        <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
          {/* Left: Chat Panel (40%) */}
          {previewMode === 'edit' && (
            <div className="w-[40%] shrink-0 border-r border-white/5">
              <StudioChatPanel />
            </div>
          )}

          {/* Center: Preview Canvas */}
          <div className="flex-1 min-w-0 relative">
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

          {/* Right: Editor Panel (collapsible) */}
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
