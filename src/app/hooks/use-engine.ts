import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Engine } from '@/engine/core/engine.ts';
import { ConfigLoader } from '@/engine/core/config-loader.ts';
import { PixiRenderer } from '@/engine/renderer/pixi-renderer.ts';
import { createModuleRegistry } from '@/engine/module-setup.ts';
import type { GameConfig, ModuleSchema } from '@/engine/core/types.ts';

// --- Engine Context ---

export interface EngineContextValue {
  engineRef: RefObject<Engine | null>;
  rendererRef: RefObject<PixiRenderer | null>;
  /** Callback ref — pass to the mount div in PreviewCanvas */
  setMountEl: (el: HTMLDivElement | null) => void;
  loadConfig: (config: GameConfig) => void;
  getModuleSchema: (moduleId: string) => ModuleSchema | null;
  ready: boolean;
}

export const EngineContext = createContext<EngineContextValue | null>(null);

export function useEngineContext(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) {
    throw new Error('useEngineContext must be used within an EngineProvider');
  }
  return ctx;
}

// --- Canvas dimensions (portrait mobile) ---
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

/**
 * Hook that creates and manages the Engine, PixiRenderer, ModuleRegistry, and ConfigLoader.
 *
 * Returns a `setMountEl` callback ref that PreviewCanvas should attach to its container div.
 * When the mount element appears, the PixiRenderer is initialised asynchronously.
 */
export function useEngine() {
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const registryRef = useRef<ReturnType<typeof createModuleRegistry> | null>(null);
  const loaderRef = useRef<ConfigLoader | null>(null);

  // Lazy initialization to avoid creating throwaway objects on re-render
  if (!engineRef.current) engineRef.current = new Engine();
  if (!registryRef.current) registryRef.current = createModuleRegistry();
  if (!loaderRef.current) loaderRef.current = new ConfigLoader(registryRef.current);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const mountElRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  // Callback ref for the mount container
  const setMountEl = useCallback((el: HTMLDivElement | null) => {
    // Teardown previous if any
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    mountElRef.current = el;

    if (!el) {
      setReady(false);
      return;
    }

    // Create <canvas> and append to mount div, scaled to fit container
    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    canvasElRef.current = canvas;

    // Create renderer and init asynchronously
    const renderer = new PixiRenderer();
    rendererRef.current = renderer;

    let disposed = false;

    const initPromise = renderer
      .init(canvas, CANVAS_WIDTH, CANVAS_HEIGHT)
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((err: unknown) => {
        console.error('PixiRenderer init failed:', err);
      });

    // Register cleanup for when mount element is removed or changed
    cleanupRef.current = () => {
      disposed = true;
      engineRef.current?.stop();

      // If init is still pending, wait for it to complete before destroying.
      // This prevents leaking a WebGL context when destroy() is a no-op
      // because `initialized` hasn't been set yet.
      initPromise.then(() => {
        renderer.destroy();
      });

      if (el.contains(canvas)) {
        el.removeChild(canvas);
      }
      rendererRef.current = null;
      canvasElRef.current = null;
      setReady(false);

      // Recreate engine for potential re-mount
      engineRef.current = new Engine();
    };
  }, []);

  // loadConfig: restart engine and reload from config
  const loadConfig = useCallback((config: GameConfig) => {
    const engine = engineRef.current;
    const loader = loaderRef.current;
    if (!engine || !loader) return;

    engine.restart();
    loader.load(engine, config);
    engine.start();

    // Wire sub-renderers (particles, float text, sound) to engine events
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.connectToEngine(engine);
    }
  }, []);

  // getModuleSchema: retrieve schema from a running engine module
  const getModuleSchema = useCallback((moduleId: string): ModuleSchema | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const mod = engine.getModule(moduleId);
    return mod ? mod.getSchema() : null;
  }, []);

  return useMemo(
    () => ({
      engineRef,
      rendererRef,
      setMountEl,
      loadConfig,
      getModuleSchema,
      ready,
    }),
    // engineRef, rendererRef are stable refs; setMountEl, loadConfig,
    // getModuleSchema are stable useCallback values. Only `ready` changes.
    [engineRef, rendererRef, setMountEl, loadConfig, getModuleSchema, ready],
  );
}
