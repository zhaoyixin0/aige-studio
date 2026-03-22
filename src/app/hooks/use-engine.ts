import { createContext, useCallback, useContext, useRef, useState } from 'react';
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
  const engineRef = useRef<Engine>(new Engine());
  const rendererRef = useRef<PixiRenderer | null>(null);
  const registryRef = useRef(createModuleRegistry());
  const loaderRef = useRef(new ConfigLoader(registryRef.current));
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

    // Create <canvas> and append to mount div
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    canvasElRef.current = canvas;

    // Create renderer and init asynchronously
    const renderer = new PixiRenderer();
    rendererRef.current = renderer;

    let disposed = false;

    renderer
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
      engineRef.current.stop();
      renderer.destroy();
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
  }, []);

  // getModuleSchema: retrieve schema from a running engine module
  const getModuleSchema = useCallback((moduleId: string): ModuleSchema | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const mod = engine.getModule(moduleId);
    return mod ? mod.getSchema() : null;
  }, []);

  return {
    engineRef,
    rendererRef,
    setMountEl,
    loadConfig,
    getModuleSchema,
    ready,
  };
}
