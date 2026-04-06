import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Share2, X, Check, Globe, FileCode } from 'lucide-react';
import { WebExporter } from '@/exporters/web-exporter.ts';
import { ApjsExporter } from '@/exporters/apjs-exporter.ts';
import { useGameStore } from '@/store/game-store.ts';
import type { GameConfig } from '@/engine/core';
import { encodeConfig } from '@/utils/config-codec';

const EMPTY_CAPABILITIES: string[] = [];

/** Stable selector — extracted to module scope so function reference never changes. */
const selectConfig = (s: { config: GameConfig | null }) => s.config;

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const config = useGameStore(selectConfig);
  const [copied, setCopied] = useState(false);

  const handleWebExport = async () => {
    if (!config) return;
    const exporter = new WebExporter();
    const html = await exporter.export(config);
    downloadFile(`${config.meta.name || 'game'}.html`, html, 'text/html');
  };

  const handleApjsExport = () => {
    if (!config) return;
    const exporter = new ApjsExporter();
    const result = exporter.export(config);
    downloadFile(`${config.meta.name || 'game'}.apjs`, result.mainScript, 'text/javascript');
  };

  const handleShare = async () => {
    if (!config) return;
    const encoded = encodeConfig(config);
    const url = `${window.location.origin}${window.location.pathname}#config=${encoded}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const capabilities = useMemo(
    () => (config ? new ApjsExporter().export(config).requiredCapabilities : EMPTY_CAPABILITIES),
    [config],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] bg-gray-900 border border-white/10 rounded-lg shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-white">
              <Download size={16} className="text-blue-400" />
              Export &amp; Share
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-gray-400 mb-5">
            Export your game for the web, Effect House, or share it with others.
          </Dialog.Description>

          {/* Web Export */}
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-green-400" />
              <span className="text-xs font-medium text-white">Web Export</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Download a standalone HTML file that runs in any browser.
              {config && (
                <span className="text-gray-500 ml-1">
                  ({config.meta.name || 'game'}.html)
                </span>
              )}
            </p>
            <button
              onClick={handleWebExport}
              disabled={!config}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              Download HTML
            </button>
          </div>

          {/* .apjs Export */}
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <FileCode size={14} className="text-orange-400" />
              <span className="text-xs font-medium text-white">.apjs Export</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Download as an Effect House script file.
              {config && (
                <span className="text-gray-500 ml-1">
                  ({config.meta.name || 'game'}.apjs)
                </span>
              )}
            </p>
            {capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-300 border border-orange-500/20"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={handleApjsExport}
              disabled={!config}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              Download .apjs
            </button>
          </div>

          {/* Share */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Share2 size={14} className="text-purple-400" />
              <span className="text-xs font-medium text-white">Share</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Copy a shareable link that encodes the full game configuration.
            </p>
            <button
              onClick={handleShare}
              disabled={!config}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check size={12} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={12} />
                  Copy Config Link
                </>
              )}
            </button>
          </div>

          <div className="flex justify-end mt-5">
            <Dialog.Close className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
