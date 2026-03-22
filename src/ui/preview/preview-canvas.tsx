import { useRef } from 'react';
import { PreviewToolbar } from './preview-toolbar.tsx';

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full">
      <PreviewToolbar />
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div
          ref={canvasRef}
          className="w-full h-full"
          data-canvas-mount="true"
        />
      </div>
    </div>
  );
}
