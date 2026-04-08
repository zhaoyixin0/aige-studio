import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Engine } from '@/engine/core/engine.ts';
import type { PixiRenderer } from '@/engine/renderer/pixi-renderer.ts';
import type { FaceTracker } from '@/engine/tracking/face-tracker.ts';
import type { FaceInput } from '@/engine/modules/input/face-input.ts';

export interface UseGameLoopOptions {
  engineRef: RefObject<Engine | null>;
  rendererRef: RefObject<PixiRenderer | null>;
  trackerRef?: RefObject<FaceTracker | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  videoDimensionsRef?: RefObject<{ width: number; height: number } | null>;
}

/**
 * Hook that drives a single requestAnimationFrame loop for:
 *   1. Face tracking detection (if tracker + video are available)
 *   2. PixiJS rendering (syncs visual state from engine)
 *
 * The engine's own tick loop is handled internally by Engine.start(),
 * so this hook does NOT call engine.tick().
 *
 * Returns start/stop controls.
 */
export function useGameLoop({ engineRef, rendererRef, trackerRef, videoRef, videoDimensionsRef }: UseGameLoopOptions) {
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastTimeRef = useRef(0);
  const fpsRef = useRef(0);

  const loop = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) return;

      // Calculate dt in milliseconds
      const dt = lastTimeRef.current > 0 ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;

      // Sliding-average FPS: weighted towards recent frames (α = 0.1)
      fpsRef.current = 0.9 * fpsRef.current + 0.1 * (1000 / Math.max(dt, 1));

      const engine = engineRef.current;
      const renderer = rendererRef.current;

      // Feed video dimensions to FaceInput modules (before tracking, so remapping is ready)
      if (engine) {
        const dims = videoDimensionsRef?.current;
        if (dims) {
          const faceModules = engine.getModulesByType('FaceInput');
          for (const mod of faceModules) {
            (mod as FaceInput).setVideoDimensions(dims.width, dims.height);
          }
        }
      }

      // Run face tracking if available
      if (trackerRef?.current && videoRef?.current && engine) {
        const result = trackerRef.current.detect(videoRef.current, timestamp);
        if (result) {
          const faceModules = engine.getModulesByType('FaceInput');
          for (const mod of faceModules) {
            (mod as FaceInput).setTracker(trackerRef.current);
          }
        }
      }

      // Render current engine state via PixiJS, passing dt for particle/float-text updates
      if (renderer && engine) {
        renderer.render(engine, dt);
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [engineRef, rendererRef, trackerRef, videoRef, videoDimensionsRef],
  );

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, fpsRef };
}
