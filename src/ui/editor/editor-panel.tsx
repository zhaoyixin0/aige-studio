import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Layers, Settings, Image, Sparkles, Activity } from 'lucide-react';
import { ModuleList } from './module-list.tsx';
import { PropertiesPanel } from './properties-panel.tsx';
import { GameFeelScore } from './game-feel-score.tsx';
import { GameFeelSuggestions } from './game-feel-suggestions.tsx';
import { AssetBrowser } from '@/ui/assets/asset-browser.tsx';
import { AssetUpload } from '@/ui/assets/asset-upload.tsx';
import { AIGenerateDialog } from '@/ui/assets/ai-generate-dialog.tsx';
import { useEditorStore } from '@/store/editor-store.ts';

export function EditorPanel() {
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const gameFeel = useEditorStore((s) => s.gameFeel);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-white/5">
      <Tabs.Root defaultValue="modules" className="flex flex-col h-full">
        {/* Tab triggers */}
        <Tabs.List className="flex border-b border-white/5 shrink-0">
          <Tabs.Trigger
            value="modules"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 border-b-2 border-transparent data-[state=active]:text-white data-[state=active]:border-blue-500 transition-colors"
          >
            <Layers size={13} />
            Modules
          </Tabs.Trigger>
          <Tabs.Trigger
            value="assets"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 border-b-2 border-transparent data-[state=active]:text-white data-[state=active]:border-blue-500 transition-colors"
          >
            <Image size={13} />
            Assets
          </Tabs.Trigger>
          <Tabs.Trigger
            value="gamefeel"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 border-b-2 border-transparent data-[state=active]:text-white data-[state=active]:border-blue-500 transition-colors"
          >
            <Activity size={13} />
            Game Feel
          </Tabs.Trigger>
        </Tabs.List>

        {/* Modules tab content */}
        <Tabs.Content value="modules" className="flex flex-col flex-1 min-h-0">
          {/* Module List Section */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <Layers size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Modules
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <ModuleList />
            </div>
          </div>

          {/* Properties Section */}
          <div className="flex flex-col flex-1 min-h-0 border-t border-white/5">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <Settings size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Properties
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PropertiesPanel />
            </div>
          </div>
        </Tabs.Content>

        {/* Assets tab content */}
        <Tabs.Content value="assets" className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-3 p-3">
            {/* AI Generate button */}
            <button
              onClick={() => setAiDialogOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-colors text-xs"
            >
              <Sparkles size={14} />
              AI Generate
            </button>

            {/* Upload section */}
            <AssetUpload />

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Asset browser */}
            <AssetBrowser />
          </div>
        </Tabs.Content>

        {/* Game Feel tab content */}
        <Tabs.Content value="gamefeel" className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            <GameFeelScore
              score={gameFeel.score}
              dimensions={gameFeel.dimensions}
              badge={gameFeel.badge}
            />
            <GameFeelSuggestions
              suggestions={gameFeel.suggestions}
              onApply={() => {/* TODO: wire apply action */}}
            />
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* AI Generation Dialog */}
      <AIGenerateDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </div>
  );
}
