import { create } from 'zustand';
import type { AssetEntry, GameConfig, ModuleConfig } from '@/engine/core';

// Module-scope accumulators for RAF micro-batching
const liveAccumulator = new Map<string, Record<string, unknown>>();
let liveScheduled = false;

/** Reset accumulator state — for tests and HMR only */
export function __resetLiveAccumulator(): void {
  liveAccumulator.clear();
  liveScheduled = false;
}

interface GameStore {
  config: GameConfig | null;
  /** Monotonically increasing version — incremented on every config mutation */
  configVersion: number;

  setConfig: (config: GameConfig) => void;

  updateModuleParam: (moduleId: string, param: string, value: unknown) => void;

  addModule: (module: ModuleConfig) => void;

  removeModule: (moduleId: string) => void;

  toggleModule: (moduleId: string) => void;

  updateAsset: (assetId: string, src: string) => void;

  addAsset: (assetId: string, entry: AssetEntry) => void;

  batchUpdateAssets: (assets: Record<string, AssetEntry>) => void;

  batchUpdateParams: (
    updates: Array<{ moduleId: string; changes: Record<string, unknown> }>
  ) => void;

  updateModuleParamLive: (moduleId: string, param: string, value: unknown) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  config: null,
  configVersion: 0,

  setConfig: (config) => set({ config, configVersion: get().configVersion + 1 }),

  updateModuleParam: (moduleId, param, value) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          modules: state.config.modules.map((m) =>
            m.id === moduleId
              ? { ...m, params: { ...m.params, [param]: value } }
              : m,
          ),
        },
        configVersion: state.configVersion + 1,
      };
    }),

  addModule: (module) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          modules: [...state.config.modules, module],
        },
        configVersion: state.configVersion + 1,
      };
    }),

  removeModule: (moduleId) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          modules: state.config.modules.map((m) =>
            m.id === moduleId ? { ...m, enabled: false } : m,
          ),
        },
        configVersion: state.configVersion + 1,
      };
    }),

  toggleModule: (moduleId) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          modules: state.config.modules.map((m) =>
            m.id === moduleId ? { ...m, enabled: !m.enabled } : m,
          ),
        },
        configVersion: state.configVersion + 1,
      };
    }),

  updateAsset: (assetId, src) =>
    set((state) => {
      if (!state.config) return state;
      const existing = state.config.assets[assetId];
      if (!existing) return state;
      return {
        config: {
          ...state.config,
          assets: {
            ...state.config.assets,
            [assetId]: { ...existing, src },
          },
        },
        configVersion: state.configVersion + 1,
      };
    }),

  addAsset: (assetId, entry) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          assets: {
            ...state.config.assets,
            [assetId]: entry,
          },
        },
        configVersion: state.configVersion + 1,
      };
    }),

  batchUpdateParams: (updates) =>
    set((state) => {
      if (!state.config || updates.length === 0) return state;

      // Build fast lookup indices for updates
      const byExactId = new Map<string, Record<string, unknown>>();
      const byNormalized = new Map<string, Record<string, unknown>>();

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const baseId = (id: string) => id.replace(/_\d+$/, '');

      for (const u of updates) {
        // Last write wins per target for deterministic behavior
        byExactId.set(u.moduleId, { ...(byExactId.get(u.moduleId) ?? {}), ...u.changes });

        const normKey = normalize(u.moduleId);
        byNormalized.set(normKey, { ...(byNormalized.get(normKey) ?? {}), ...u.changes });
      }

      const nextModules = state.config.modules.map((m) => {
        // 1) Exact id match
        let changes = byExactId.get(m.id);

        if (!changes) {
          // 2) Match by normalized variants of id/baseId/type
          const normId = normalize(m.id);
          const normBase = normalize(baseId(m.id));
          const normType = normalize(m.type);

          changes =
            byNormalized.get(normId) ||
            byNormalized.get(normBase) ||
            byNormalized.get(normType);
        }

        if (!changes) return m;
        return { ...m, params: { ...m.params, ...changes } };
      });

      return {
        config: { ...state.config, modules: nextModules },
        configVersion: state.configVersion + 1,
      };
    }),

  batchUpdateAssets: (assets) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          assets: {
            ...state.config.assets,
            ...assets,
          },
        },
        configVersion: state.configVersion + 1,
      };
    }),

  updateModuleParamLive: (moduleId, param, value) => {
    const existing = liveAccumulator.get(moduleId) ?? {};
    liveAccumulator.set(moduleId, { ...existing, [param]: value });

    if (!liveScheduled) {
      liveScheduled = true;
      requestAnimationFrame(() => {
        const updates = Array.from(liveAccumulator.entries()).map(
          ([modId, changes]) => ({ moduleId: modId, changes })
        );
        liveAccumulator.clear();
        liveScheduled = false;

        if (updates.length > 0) {
          get().batchUpdateParams(updates);
        }
      });
    }
  },
}));

// Expose store for renderer access (background sync)
if (typeof window !== 'undefined') {
  (window as any).__gameStore = useGameStore;
}
