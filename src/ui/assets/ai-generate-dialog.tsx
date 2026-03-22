import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, X } from 'lucide-react';

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIGenerateDialog({ open, onOpenChange }: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');

  function handleGenerate() {
    // Placeholder — AI generation not yet implemented
    // When ready: call image generation API, store result with ai-generated:// prefix
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-gray-900 border border-white/10 rounded-lg shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles size={16} className="text-purple-400" />
              AI Image Generation
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-white transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-gray-400 mb-4">
            Describe the image you want to generate. The AI will create a game
            asset based on your description.
          </Dialog.Description>

          <div className="flex flex-col gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A cute pixel art star with a happy face, transparent background"
              rows={3}
              className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
            />

            <div className="flex items-center gap-2 p-3 rounded bg-purple-500/10 border border-purple-500/20">
              <Sparkles size={14} className="text-purple-400 shrink-0" />
              <span className="text-xs text-purple-300">
                Coming soon — AI image generation will be available in a future
                update.
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleGenerate}
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-purple-600/50 text-purple-300 cursor-not-allowed"
              >
                <Sparkles size={12} />
                Generate
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
