import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseResizeDividerOptions {
  minWidth?: number;
  maxWidthRatio?: number;
}

/**
 * Hook for a draggable divider that resizes a panel.
 * Manages document-level mouse listeners with proper cleanup on unmount.
 */
export function useResizeDivider(
  initialWidth: number,
  options?: UseResizeDividerOptions,
) {
  const { minWidth = 320, maxWidthRatio = 0.6 } = options ?? {};
  const [width, setWidth] = useState(initialWidth);
  const isDraggingRef = useRef(false);

  // Use refs for handlers so we can add/remove the exact same function references
  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<(() => void) | null>(null);

  const cleanupListeners = useCallback(() => {
    if (handleMouseMoveRef.current) {
      document.removeEventListener('mousemove', handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      document.removeEventListener('mouseup', handleMouseUpRef.current);
    }
    document.body.style.cursor = '';
    isDraggingRef.current = false;
    handleMouseMoveRef.current = null;
    handleMouseUpRef.current = null;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const maxWidth = window.innerWidth * maxWidthRatio;
      const newWidth = Math.max(minWidth, Math.min(ev.clientX, maxWidth));
      setWidth(newWidth);
    };

    const onUp = () => {
      cleanupListeners();
    };

    handleMouseMoveRef.current = onMove;
    handleMouseUpRef.current = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [minWidth, maxWidthRatio, cleanupListeners]);

  // Cleanup on unmount — prevents listener leak if component unmounts mid-drag
  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  return { width, onMouseDown };
}
