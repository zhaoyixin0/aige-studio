import { useCallback } from 'react';
import { Settings } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import { SchemaRenderer } from './schema-renderer.tsx';
import { useEngineContext } from '@/app/hooks/use-engine.ts';
import type { GameConfig } from '@/engine/core';

/** Stable selectors — extracted to module scope so function references never change. */
const selectSelectedModuleId = (s: { selectedModuleId: string | null }) => s.selectedModuleId;
const selectConfig = (s: { config: GameConfig | null }) => s.config;
const selectUpdateModuleParam = (s: { updateModuleParam: (moduleId: string, param: string, value: unknown) => void }) => s.updateModuleParam;

export function PropertiesPanel() {
  const selectedModuleId = useEditorStore(selectSelectedModuleId);
  const config = useGameStore(selectConfig);
  const updateModuleParam = useGameStore(selectUpdateModuleParam);
  const { engineRef, getModuleSchema, ready } = useEngineContext();

  // Get live schema from the running engine module
  const schema = ready && selectedModuleId ? getModuleSchema(selectedModuleId) : null;

  const handleChange = useCallback(
    (param: string, value: unknown) => {
      if (!selectedModuleId) return;

      // Update the store (persisted config)
      updateModuleParam(selectedModuleId, param, value);

      // Also configure the live engine module for immediate preview update
      const mod = engineRef.current?.getModule(selectedModuleId);
      if (mod) {
        mod.configure({ [param]: value });
      }
    },
    [selectedModuleId, updateModuleParam, engineRef],
  );

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
          onChange={handleChange}
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
