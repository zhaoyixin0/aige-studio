import { Layers, Settings } from 'lucide-react';
import { ModuleList } from './module-list.tsx';
import { PropertiesPanel } from './properties-panel.tsx';

export function EditorPanel() {
  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-white/5">
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
    </div>
  );
}
