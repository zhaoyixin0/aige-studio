import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface FpsOverlayProps {
  fpsRef: RefObject<number>;
}

export function FpsOverlay({ fpsRef }: FpsOverlayProps) {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFps(Math.round(fpsRef.current ?? 0));
    }, 1000);
    return () => clearInterval(id);
  }, [fpsRef]);

  return (
    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded pointer-events-none z-50">
      {fps} FPS
    </div>
  );
}
