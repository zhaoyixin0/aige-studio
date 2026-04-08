import { useEffect } from 'react';
import { PreviewToolbar } from './preview-toolbar.tsx';
import { StepIndicator } from './step-indicator.tsx';
import { FpsOverlay } from './fps-overlay.tsx';
import type { PreviewPhase } from '@/store/editor-store.ts';
import { useEngineContext, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/app/hooks/use-engine.ts';
import { useCamera } from '@/app/hooks/use-camera.ts';
import { useGameLoop } from '@/app/hooks/use-game-loop.ts';
import { useGameStore } from '@/store/game-store.ts';
import { useEditorStore } from '@/store/editor-store.ts';
import { CameraLayer } from '@/engine/renderer/camera-layer.ts';
import type { PreviewMode } from '@/store/editor-store.ts';

/** Stable selectors — extracted to module scope so function references never change. */
const selectPreviewMode = (s: { previewMode: PreviewMode }) => s.previewMode;
const selectSetPreviewMode = (s: { setPreviewMode: (mode: PreviewMode) => void }) => s.setPreviewMode;
const selectPreviewPhase = (s: { previewPhase: PreviewPhase }) => s.previewPhase;
const selectShowFpsOverlay = (s: { showFpsOverlay: boolean }) => s.showFpsOverlay;

export function PreviewCanvas() {
  const { engineRef, rendererRef, setMountEl, loadConfig, ready: engineReady } = useEngineContext();
  const previewMode = useEditorStore(selectPreviewMode);
  const setPreviewMode = useEditorStore(selectSetPreviewMode);
  const previewPhase = useEditorStore(selectPreviewPhase);
  const showFpsOverlay = useEditorStore(selectShowFpsOverlay);

  // Acquire camera + face tracker + actual video dimensions
  const { videoRef, trackerRef, videoDimensionsRef, ready: cameraReady } = useCamera();

  // Set up render loop (tracking + PixiJS rendering)
  const { start: startLoop, stop: stopLoop, fpsRef } = useGameLoop({
    engineRef,
    rendererRef,
    trackerRef,
    videoRef,
    videoDimensionsRef,
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

    const dims = videoDimensionsRef.current;
    const cameraLayer = new CameraLayer(renderer.getCameraLayer());
    cameraLayer.setVideoElement(video, CANVAS_WIDTH, CANVAS_HEIGHT, dims?.width, dims?.height);

    return () => {
      cameraLayer.destroy();
    };
    // videoDimensionsRef is a stable ref; its .current is guaranteed to be populated
    // before cameraReady becomes true (use-camera.ts sets dimensions before setReady).
  }, [engineReady, cameraReady, rendererRef, videoRef]);

  // Subscribe to configVersion — incremented on every config mutation
  // (structural changes AND param changes, including AI modify_game).
  const configVersion = useGameStore((s) => s.configVersion);

  useEffect(() => {
    const cfg = useGameStore.getState().config;
    if (!engineReady || !cfg) return;
    loadConfig(cfg);

    // Bind TouchInput to canvas element for pointer events
    const engine = engineRef.current;
    if (engine) {
      const touchInputs = engine.getModulesByType('TouchInput');
      const canvasEl = rendererRef.current?.getApp()?.canvas;
      if (canvasEl && touchInputs.length > 0) {
        for (const mod of touchInputs) {
          (mod as any).setCanvas(canvasEl);
        }
      }
    }
  }, [engineReady, configVersion, loadConfig, engineRef, rendererRef]);

  const isPlayOrFullscreen = previewMode === 'play' || previewMode === 'fullscreen';

  return (
    <div className="flex flex-col h-full relative">
      {/* Hide toolbar in play/fullscreen for immersive experience */}
      {!isPlayOrFullscreen && <PreviewToolbar />}

      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div
          ref={setMountEl}
          className="flex items-center justify-center w-full h-full"
          data-canvas-mount="true"
        />
      </div>

      {/* Step progress indicator */}
      {!isPlayOrFullscreen && (
        <div className="border-t border-white/5">
          <StepIndicator phase={previewPhase} />
        </div>
      )}

      {/* FPS overlay — shown when enabled, positioned inside the canvas area */}
      {showFpsOverlay && <FpsOverlay fpsRef={fpsRef} />}

      {/* Exit button overlay in play mode */}
      {previewMode === 'play' && (
        <button
          onClick={() => setPreviewMode('edit')}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-sm border border-white/10 transition-colors"
        >
          Exit Play Mode
        </button>
      )}
    </div>
  );
}
