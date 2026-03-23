import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, X, Loader2, RefreshCw, Check } from 'lucide-react';
import {
  getGeminiImageService,
  type ImageStyle,
} from '@/services/gemini-image.ts';
import { useGameStore } from '@/store/game-store.ts';
import type { AssetEntry } from '@/engine/core';

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STYLES: { value: ImageStyle; label: string }[] = [
  { value: 'cartoon', label: '\u5361\u901A' },
  { value: 'pixel', label: '\u50CF\u7D20' },
  { value: 'flat', label: '\u6241\u5E73' },
  { value: 'realistic', label: '\u5199\u5B9E' },
];

const selectAddAsset = (s: { addAsset: (id: string, entry: AssetEntry) => void }) => s.addAsset;

export function AIGenerateDialog({ open, onOpenChange }: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('cartoon');
  const [loading, setLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addAsset = useGameStore(selectAddAsset);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageDataUrl(null);
    setSaved(false);

    try {
      const service = getGeminiImageService();
      const dataUrl = await service.generateImage(prompt.trim(), style);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [prompt, style]);

  const handleUseAsset = useCallback(() => {
    if (!imageDataUrl) return;

    const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: AssetEntry = { type: 'sprite', src: imageDataUrl };
    addAsset(id, entry);
    setSaved(true);

    // Auto-close after a brief delay so the user sees the confirmation
    setTimeout(() => {
      onOpenChange(false);
      // Reset state for next open
      setPrompt('');
      setImageDataUrl(null);
      setError(null);
      setSaved(false);
    }, 600);
  }, [imageDataUrl, addAsset, onOpenChange]);

  const handleRegenerate = useCallback(() => {
    setSaved(false);
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] max-h-[90vh] overflow-y-auto bg-gray-900 border border-white/10 rounded-lg shadow-2xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles size={16} className="text-purple-400" />
              AI {'\u7D20\u6750\u751F\u6210'}
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-gray-400 mb-4">
            {'\u63CF\u8FF0\u4F60\u60F3\u8981\u7684\u7D20\u6750\uFF0CAI \u5C06\u6839\u636E\u63CF\u8FF0\u751F\u6210\u6E38\u620F\u7D20\u6750\u3002'}
          </Dialog.Description>

          <div className="flex flex-col gap-4">
            {/* Prompt input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300">
                {'\u63CF\u8FF0\u4F60\u60F3\u8981\u7684\u7D20\u6750\uFF1A'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={'\u4F8B\u5982\uFF1A\u4E00\u4E2A\u95EA\u4EAE\u7684\u91D1\u8272\u661F\u661F\u56FE\u6807'}
                rows={3}
                disabled={loading}
                className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 resize-none disabled:opacity-50"
              />
            </div>

            {/* Style selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300">
                {'\u98CE\u683C\uFF1A'}
              </label>
              <div className="flex gap-2">
                {STYLES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStyle(value)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded text-xs transition-colors border ${
                      style === value
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                        : 'text-gray-400 hover:bg-white/5 border-white/10 hover:border-white/20'
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {'\u751F\u6210\u4E2D\u2026'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {'\u751F\u6210\u7D20\u6750'}
                </>
              )}
            </button>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Image preview */}
            {imageDataUrl && (
              <div className="flex flex-col gap-3">
                <div className="rounded border border-white/10 bg-[repeating-conic-gradient(#1a1a2e_0%_25%,#12121e_0%_50%)] bg-[length:16px_16px] flex items-center justify-center p-4">
                  <img
                    src={imageDataUrl}
                    alt="AI generated asset"
                    className="max-w-full max-h-[240px] rounded object-contain"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleRegenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    {'\u91CD\u65B0\u751F\u6210'}
                  </button>
                  <button
                    onClick={handleUseAsset}
                    disabled={loading || saved}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      saved
                        ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    } disabled:cursor-not-allowed`}
                  >
                    {saved ? (
                      <>
                        <Check size={12} />
                        {'\u5DF2\u6DFB\u52A0'}
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        {'\u4F7F\u7528\u7D20\u6750'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
