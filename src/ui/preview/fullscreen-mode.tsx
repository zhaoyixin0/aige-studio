import { useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store.ts';
import type { PreviewMode } from '@/store/editor-store.ts';

/** Stable selector — extracted to module scope so function reference never changes. */
const selectSetPreviewMode = (s: { setPreviewMode: (mode: PreviewMode) => void }) => s.setPreviewMode;

/**
 * Manages browser Fullscreen API lifecycle.
 *
 * When mounted, requests fullscreen on the document element.
 * When unmounted, exits fullscreen.
 * Listens for the native `fullscreenchange` event so that pressing ESC
 * (which the browser handles natively) correctly resets previewMode to 'edit'.
 */
export function FullscreenMode() {
  const setPreviewMode = useEditorStore(selectSetPreviewMode);

  useEffect(() => {
    const enter = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen request may fail (e.g. user gesture requirement).
        // Fall back to edit mode so the UI doesn't get stuck.
        setPreviewMode('edit');
      }
    };

    enter();

    const handleChange = () => {
      // If fullscreen was exited (e.g. user pressed ESC), reset to edit mode.
      if (!document.fullscreenElement) {
        setPreviewMode('edit');
      }
    };

    document.addEventListener('fullscreenchange', handleChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);

      // Exit fullscreen on unmount if still active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, [setPreviewMode]);

  // This component is invisible; the fullscreen API operates on the whole document.
  return null;
}
