import { Settings } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import { SchemaRenderer } from './schema-renderer.tsx';
import type { ModuleSchema } from '@/engine/core/types.ts';

export function PropertiesPanel() {
  const selectedModuleId = useEditorStore((s) => s.selectedModuleId);
  const config = useGameStore((s) => s.config);
  const updateModuleParam = useGameStore((s) => s.updateModuleParam);

  if (!selectedModuleId || !config) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-sm">
        <Settings size={24} className="mb-2 opacity-50" />
        Select a module to edit
      </div>
    );
  }

  const moduleConfig = config.modules.find((m) => m.id === selectedModuleId);
  if (!moduleConfig) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        Module not found
      </div>
    );
  }

  // Schema will be provided by the engine integration (Task 12).
  // For now, render a JSON fallback for params.
  const schema: ModuleSchema | null = null;

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <span className="text-sm font-medium text-white">{moduleConfig.type}</span>
        <span className="text-xs text-gray-500">{moduleConfig.id}</span>
      </div>

      {schema ? (
        <SchemaRenderer
          schema={schema}
          values={moduleConfig.params}
          onChange={(param, value) => updateModuleParam(selectedModuleId, param, value)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-400">Parameters (raw)</span>
          <pre className="text-xs text-gray-300 bg-white/5 rounded p-2 overflow-auto max-h-60 whitespace-pre-wrap break-all">
            {JSON.stringify(moduleConfig.params, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
