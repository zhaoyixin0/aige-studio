import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseResizeDividerOptions {
  minWidth?: number;
  maxWidthRatio?: number;
}

/**
 * Hook for a draggable divider that resizes a panel.
 * Manages document-level mouse AND touch listeners with proper cleanup on unmount.
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
  const handleTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const handleTouchEndRef = useRef<(() => void) | null>(null);

  const cleanupListeners = useCallback(() => {
    if (handleMouseMoveRef.current) {
      document.removeEventListener('mousemove', handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      document.removeEventListener('mouseup', handleMouseUpRef.current);
    }
    if (handleTouchMoveRef.current) {
      document.removeEventListener('touchmove', handleTouchMoveRef.current);
    }
    if (handleTouchEndRef.current) {
      document.removeEventListener('touchend', handleTouchEndRef.current);
    }
    document.body.style.cursor = '';
    isDraggingRef.current = false;
    handleMouseMoveRef.current = null;
    handleMouseUpRef.current = null;
    handleTouchMoveRef.current = null;
    handleTouchEndRef.current = null;
  }, []);

  const clampWidth = useCallback(
    (clientX: number) => {
      const maxWidth = window.innerWidth * maxWidthRatio;
      return Math.max(minWidth, Math.min(clientX, maxWidth));
    },
    [minWidth, maxWidthRatio],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = 'col-resize';

      const onMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        setWidth(clampWidth(ev.clientX));
      };

      const onUp = () => {
        cleanupListeners();
      };

      handleMouseMoveRef.current = onMove;
      handleMouseUpRef.current = onUp;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [clampWidth, cleanupListeners],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = 'col-resize';

      const onMove = (ev: TouchEvent) => {
        if (!isDraggingRef.current) return;
        const touch = ev.touches[0];
        if (touch) {
          setWidth(clampWidth(touch.clientX));
        }
      };

      const onEnd = () => {
        cleanupListeners();
      };

      handleTouchMoveRef.current = onMove;
      handleTouchEndRef.current = onEnd;
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    },
    [clampWidth, cleanupListeners],
  );

  // Cleanup on unmount — prevents listener leak if component unmounts mid-drag
  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  return { width, onMouseDown, onTouchStart };
}
