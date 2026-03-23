import * as Switch from '@radix-ui/react-switch';
import { Box } from 'lucide-react';
import { useGameStore } from '@/store/game-store.ts';
import { useEditorStore } from '@/store/editor-store.ts';
import type { ModuleConfig } from '@/engine/core';

const EMPTY_MODULES: ModuleConfig[] = [];

/** Stable selectors — extracted to module scope so function references never change. */
const selectModules = (s: { config: { modules: ModuleConfig[] } | null }) =>
  s.config?.modules ?? EMPTY_MODULES;
const selectToggleModule = (s: { toggleModule: (id: string) => void }) => s.toggleModule;
const selectSelectedModuleId = (s: { selectedModuleId: string | null }) => s.selectedModuleId;
const selectSelectModule = (s: { selectModule: (id: string | null) => void }) => s.selectModule;

export function ModuleList() {
  const modules = useGameStore(selectModules);
  const toggleModule = useGameStore(selectToggleModule);
  const selectedModuleId = useEditorStore(selectSelectedModuleId);
  const selectModule = useEditorStore(selectSelectModule);

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-sm">
        <Box size={24} className="mb-2 opacity-50" />
        No modules loaded
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {modules.map((mod) => (
        <button
          key={mod.id}
          onClick={() => selectModule(mod.id === selectedModuleId ? null : mod.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
            selectedModuleId === mod.id
              ? 'bg-blue-600/20 border border-blue-500/30'
              : 'hover:bg-white/5 border border-transparent'
          }`}
        >
          <Box size={14} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{mod.type}</div>
            <div className="text-xs text-gray-500 truncate">{mod.id}</div>
          </div>
          <Switch.Root
            checked={mod.enabled}
            onCheckedChange={() => toggleModule(mod.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-4 bg-white/10 rounded-full relative data-[state=checked]:bg-green-600 transition-colors shrink-0"
          >
            <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[14px]" />
          </Switch.Root>
        </button>
      ))}
    </div>
  );
}
