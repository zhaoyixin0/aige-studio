import { useState } from 'react';
import { Pencil, Play, Maximize, Download } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import type { PreviewMode } from '@/store/editor-store.ts';
import { ExportDialog } from '@/ui/export/export-dialog.tsx';
import { DiagnosticBadge } from './diagnostic-badge.tsx';

const modes: Array<{ mode: PreviewMode; icon: typeof Pencil; label: string }> = [
  { mode: 'edit', icon: Pencil, label: 'Edit' },
  { mode: 'play', icon: Play, label: 'Play' },
  { mode: 'fullscreen', icon: Maximize, label: 'Fullscreen' },
];

/** Stable selectors — extracted to module scope so function references never change. */
const selectPreviewMode = (s: { previewMode: PreviewMode }) => s.previewMode;
const selectSetPreviewMode = (s: { setPreviewMode: (mode: PreviewMode) => void }) => s.setPreviewMode;

export function PreviewToolbar() {
  const previewMode = useEditorStore(selectPreviewMode);
  const setPreviewMode = useEditorStore(selectSetPreviewMode);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-gray-900">
      <span className="text-xs font-medium text-gray-400 mr-2 uppercase tracking-wider">
        Preview
      </span>
      <div className="flex items-center gap-1">
        {modes.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setPreviewMode(mode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              previewMode === mode
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={label}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <DiagnosticBadge />
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Export & Share"
        >
          <Download size={14} />
          Export
        </button>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
