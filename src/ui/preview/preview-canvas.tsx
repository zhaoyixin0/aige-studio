import { useEffect } from 'react';
import { PreviewToolbar } from './preview-toolbar.tsx';
import { useEngineContext } from '@/app/hooks/use-engine.ts';
import { useCamera } from '@/app/hooks/use-camera.ts';
import { useGameLoop } from '@/app/hooks/use-game-loop.ts';
import { useGameStore } from '@/store/game-store.ts';
import { CameraLayer } from '@/engine/renderer/camera-layer.ts';

export function PreviewCanvas() {
  const { engineRef, rendererRef, setMountEl, loadConfig, ready: engineReady } = useEngineContext();

  // Acquire camera + face tracker
  const { videoRef, trackerRef, ready: cameraReady } = useCamera();

  // Set up render loop (tracking + PixiJS rendering)
  const { start: startLoop, stop: stopLoop } = useGameLoop({
    engineRef,
    rendererRef,
    trackerRef,
    videoRef,
  });

  // Start/stop the render loop when the engine is ready
  useEffect(() => {
    if (engineReady) {
      startLoop();
    }
    return () => {
      stopLoop();
    };
  }, [engineReady, startLoop, stopLoop]);

  // Attach camera feed to the renderer's camera layer once both are ready
  useEffect(() => {
    if (!engineReady || !cameraReady) return;
    const renderer = rendererRef.current;
    const video = videoRef.current;
    if (!renderer || !video) return;

    const cameraLayer = new CameraLayer(renderer.getCameraLayer());
    cameraLayer.setVideoElement(video, 1080, 1920);

    return () => {
      cameraLayer.destroy();
    };
  }, [engineReady, cameraReady, rendererRef, videoRef]);

  // Subscribe to structural config changes only (add/remove/toggle modules).
  // Param-only changes are handled directly by PropertiesPanel via mod.configure().
  const configStructureKey = useGameStore((s) =>
    s.config?.modules.map((m) => `${m.id}:${m.type}:${m.enabled}`).join('|') ?? '',
  );

  useEffect(() => {
    const cfg = useGameStore.getState().config;
    if (!engineReady || !cfg) return;
    loadConfig(cfg);
  }, [engineReady, configStructureKey, loadConfig]);

  return (
    <div className="flex flex-col h-full">
      <PreviewToolbar />
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div
          ref={setMountEl}
          className="w-full h-full"
          data-canvas-mount="true"
        />
      </div>
    </div>
  );
}
