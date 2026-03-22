import { ChatPanel } from '@/ui/chat/chat-panel.tsx';
import { PreviewCanvas } from '@/ui/preview/preview-canvas.tsx';
import { EditorPanel } from '@/ui/editor/editor-panel.tsx';
import { useEngine, EngineContext } from '@/app/hooks/use-engine.ts';

export function MainLayout() {
  const engine = useEngine();

  return (
    <EngineContext.Provider value={engine}>
      <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="w-80 shrink-0">
          <ChatPanel />
        </div>

        {/* Center: Preview Canvas */}
        <div className="flex-1 min-w-0">
          <PreviewCanvas />
        </div>

        {/* Right: Editor Panel */}
        <div className="w-80 shrink-0">
          <EditorPanel />
        </div>
      </div>
    </EngineContext.Provider>
  );
}
