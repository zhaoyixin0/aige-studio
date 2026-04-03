/**
 * Engine Bridge — subscribes to game-store configVersion changes
 * and applies incremental ConfigLoader.applyChanges() to the live engine.
 *
 * Uses RAF-level debouncing to coalesce rapid slider updates
 * into a single applyChanges call per frame.
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { useEngineContext } from '@/app/hooks/use-engine';
import type { ConfigChange } from '@/engine/core/config-loader';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameConfig } from '@/engine/core/types';
import type { Engine } from '@/engine/core/engine';

/**
 * Diff two GameConfig objects and produce ConfigChange[] for update_param ops.
 * Only compares module params (not assets, canvas, meta).
 */
export function buildConfigChanges(
  oldConfig: GameConfig,
  newConfig: GameConfig
): ConfigChange[] {
  const changes: ConfigChange[] = [];

  const oldModules = new Map(oldConfig.modules.map((m) => [m.id, m]));

  for (const newMod of newConfig.modules) {
    const oldMod = oldModules.get(newMod.id);
    if (!oldMod) continue;

    const changedParams: Record<string, unknown> = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(newMod.params)) {
      if (oldMod.params[key] !== value) {
        changedParams[key] = value;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      changes.push({
        op: 'update_param',
        moduleId: newMod.id,
        params: changedParams,
      });
    }
  }

  return changes;
}

/**
 * Create a Zustand subscription that bridges store → engine.
 * Returns an unsubscribe function.
 *
 * Exported for testing — the hook `useEngineBridge` wraps this in useEffect.
 */
export function createEngineBridge(
  getEngine: () => Engine | null,
  getLoader: () => ConfigLoader | null
): () => void {
  let prevConfig: GameConfig | null = null;
  let rafId: number | null = null;

  const unsubscribe = useGameStore.subscribe((state) => {
    const newConfig = state.config;
    if (!newConfig || newConfig === prevConfig) return;

    const engine = getEngine();
    const loader = getLoader();
    if (!engine || !loader) {
      prevConfig = newConfig;
      return;
    }

    // If first time (no prevConfig), skip diff — full load should be done via loadConfig
    if (!prevConfig) {
      prevConfig = newConfig;
      return;
    }

    const oldCfg = prevConfig;
    prevConfig = newConfig;

    // Debounce via RAF — coalesce multiple rapid updates
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      const changes = buildConfigChanges(oldCfg, newConfig);
      if (changes.length > 0) {
        loader.applyChanges(engine, changes);
      }
    });
  });

  return () => {
    unsubscribe();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
}

/**
 * React hook — wire store → engine bridge with automatic cleanup.
 * Place this in the layout component alongside EngineProvider.
 */
export function useEngineBridge(): void {
  const { engineRef } = useEngineContext();
  const loaderRef = useRef<ConfigLoader | null>(null);

  if (!loaderRef.current) {
    loaderRef.current = new ConfigLoader(createModuleRegistry());
  }

  useEffect(() => {
    const cleanup = createEngineBridge(
      () => engineRef.current,
      () => loaderRef.current
    );
    return cleanup;
  }, [engineRef]);
}
