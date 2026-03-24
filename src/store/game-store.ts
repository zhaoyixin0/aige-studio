import { create } from 'zustand';
import type { AssetEntry, GameConfig, ModuleConfig } from '@/engine/core';

interface GameStore {
  config: GameConfig | null;

  setConfig: (config: GameConfig) => void;

  updateModuleParam: (moduleId: string, param: string, value: unknown) => void;

  addModule: (module: ModuleConfig) => void;

  removeModule: (moduleId: string) => void;

  toggleModule: (moduleId: string) => void;

  updateAsset: (assetId: string, src: string) => void;

  addAsset: (assetId: string, entry: AssetEntry) => void;

  batchUpdateAssets: (assets: Record<string, AssetEntry>) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  config: null,

  setConfig: (config) => set({ config }),

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
      };
    }),
}));

// Expose store for renderer access (background sync)
if (typeof window !== 'undefined') {
  (window as any).__gameStore = useGameStore;
}
